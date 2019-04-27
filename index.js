var collect = require('collect-stream')
var duplexify = require('duplexify')
var mutexify = require('mutexify')
var defaults = require('levelup-defaults')
var through = require('through2')
var pump = require('pump')
var once = require('once')

var GROUP = 'g!'
var GROUP_MEMBER = 'gm!'
var MEMBER_GROUP = 'mg!'
var GROUP_HISTORY = 'gh!'
var MEMBER_HISTORY = 'mh!'
var ADMIN_GROUP_HISTORY = 'ag!'
var ADMIN_MEMBER_HISTORY = 'am!'

module.exports = Auth

function Auth (db) {
  if (!(this instanceof Auth)) return new Auth(db)
  this.db = defaults(db, { valueEncoding: 'json' })
  this._lock = mutexify()
}

Auth.prototype._batchAllowed = function (batch, cb) {
  var self = this
  cb = once(cb)
  var pending = 1
  batch.forEach(function (doc, i) {
    if (doc.by === null) return
    if (doc.type === 'add') {
      pending += 2
      self._getRole({ batch, i }, doc.group, doc.id, function (err, role) {
        // check if id already has a role in the group
        if (err) return cb(err)
        if (role === 'mod' && (doc.role === 'mod' || doc.role === 'admin')) {
          cb(null, false)
        } else if (role === 'admin' && doc.role === 'admin') {
          cb(null, false)
        } else if (--pending === 0) ok()
      })
      self._canMod({ batch, i }, doc.group, doc.by, function (err, can) {
        // check if initiator of op is a mod
        if (err) return cb(err)
        else if (!can) return cb(null, false)
        else if (--pending === 0) ok()
      })
    } else if (doc.type === 'remove') {
      pending++
      self._getRole({ batch, i }, doc.group, doc.by, function (err, byRole) {
        // check if initiator of op is a mod
        if (err) return cb(err)
        if (byRole !== 'admin' && byRole !== 'mod') return cb(null, false)
        self._getRole({ batch, i }, doc.group, doc.id, function (err, role) {
          if (err) return cb(err)
          if (byRole === 'mod' && (role === 'mod' || role === 'admin')) {
            return cb(null, false)
          }
        })
        if (--pending === 0) ok()
      })
    }
  })
  if (--pending === 0) ok()
  function ok () { cb(null, true) }
}

Auth.prototype._getRole = function (b, group, id, cb) {
  cb = once(cb)
  var role = null
  var pending = 1
  if (group !== '@') {
    pending++
    var found = null
    for (var i = 0; i < b.i; i++) {
      var doc = b.batch[i]
      if (doc.group === '@' && doc.id === id) {
        if (doc.type === 'add') found = { add: doc }
        else if (doc.type === 'remove') found = {}
      }
    }
    if (found) {
      onroot(null, found.add)
    } else this.db.get(GROUP_MEMBER + '@!' + id, onroot)
  }
  var found = null
  for (var i = 0; i < b.i; i++) {
    var doc = b.batch[i]
    if (doc.group === group && doc.id === id) {
      if (doc.type === 'add') found = { add: doc }
      else if (doc.type === 'remove') found = {}
    }
  }
  if (found) {
    onget(null, found.add)
  } else this.db.get(GROUP_MEMBER + group + '!' + id, onget)

  function onget (err, res) {
    if (err && !err.notFound) return cb(err)
    else if (res && res.role === 'admin') role = 'admin'
    else if (res && res.role === 'mod' && role !== 'admin') role = 'mod'
    if (--pending === 0) cb(null, role)
  }
  function onroot (err, res) {
    if (err && !err.notFound) return cb(err)
    if (res) role = 'admin'
    if (--pending === 0) cb(null, role)
  }
}

Auth.prototype._canMod = function (b, group, id, cb) {
  this._getRole(b, group, id, function (err, role) {
    if (err) cb(err)
    else cb(null, role === 'admin' || role === 'mod')
  })
}

Auth.prototype._canAdmin = function (b, group, id, cb) {
  this._getRole(b, group, id, function (err, role) {
    if (err) cb(err)
    else cb(null, role === 'admin')
  })
}

Auth.prototype.batch = function (docs, cb) {
  var self = this
  cb = once(cb)
  self._lock(function (release) {
    self._batchAllowed(docs, function (err, allowed) {
      if (err) {
        release(cb, err)
      } else if (!allowed) {
        var err = new Error('operation not allowed')
        err.type = 'NOT_ALLOWED'
        release(cb, err)
      } else insert(release)
    })
  })
  function insert (release) {
    var batch = []
    var pending = 1
    docs.forEach(function (doc) {
      pending++
      if (doc.type === 'add') {
        batch.push({
          type: 'put',
          key: GROUP + doc.group,
          value: ''
        })
        var gmkey = GROUP_MEMBER + doc.group + '!' + doc.id
        var mgkey = MEMBER_GROUP + doc.id + '!' + doc.group
        var ghkey = GROUP_HISTORY + doc.group + '!' + doc.id + '!' + doc.key
        var mhkey = MEMBER_HISTORY + doc.id + '!' + doc.group + '!' + doc.key
        var aghkey = ADMIN_GROUP_HISTORY + doc.by + '!' + doc.group
          + '!' + doc.id + '!' + doc.key
        var amhkey = ADMIN_MEMBER_HISTORY + doc.by + '!' + doc.id
          + '!' + doc.group + '!' + doc.key
        self.db.get(gmkey, function (err, m) {
          if (!m || Boolean(m.mod) !== Boolean(doc.mod)) {
            var value = {}
            if (doc.role) value.role = doc.role
            // duplicate data to avoid setting a mutex around responses
            batch.push({ type: 'put', key: gmkey, value: value })
            batch.push({ type: 'put', key: mgkey, value: value })
            batch.push({ type: 'put', key: ghkey, value: 0 })
            batch.push({ type: 'put', key: mhkey, value: 0 })
            batch.push({ type: 'put', key: aghkey, value: 0 })
            batch.push({ type: 'put', key: amhkey, value: 0 })
          }
          if (--pending === 0) done(release, batch)
        })
      } else if (doc.type === 'remove') {
        batch.push({
          type: 'del',
          key: GROUP_MEMBER + doc.group + '!' + doc.id
        })
        batch.push({
          type: 'del',
          key: MEMBER_GROUP + doc.id + '!' + doc.group
        })
        if (--pending === 0) done(release, batch)
      } else {
        if (--pending === 0) done(release, batch)
      }
    })
    if (--pending === 0) done(release, batch)
  }
  function done (release, batch) {
    self.db.batch(batch, function (err) {
      release(cb, err)
    })
  }
}

Auth.prototype.getGroups = function (cb) {
  var self = this
  var d = duplexify.obj()
  self._lock(function (release) {
    var r = self.db.createReadStream({
      gt: GROUP,
      lt: GROUP + '\uffff'
    })
    var out = through.obj(function (row, enc, next) {
      next(null, {
        id: row.key.slice(GROUP.length)
      })
    })
    pump(r, out)
    if (typeof cb === 'function') {
      collect(out, function (err, groups) {
        cb(err, groups)
      })
    }
    d.setReadable(out)
    release()
  })
  return d
}

Auth.prototype.getMembers = function (group, cb) {
  var self = this
  var d = duplexify.obj()
  self._lock(function (release) {
    var r = self.db.createReadStream({
      gt: GROUP_MEMBER + group + '!',
      lt: GROUP_MEMBER + group + '!\uffff'
    })
    var out = through.obj(function (row, enc, next) {
      next(null, Object.assign({
        id: row.key.slice(GROUP_MEMBER.length + group.length + 1)
      }, row.value))
    })
    pump(r, out)
    if (typeof cb === 'function') {
      collect(out, function (err, groups) {
        cb(err, groups)
      })
    }
    d.setReadable(out)
    release()
  })
  return d
}

Auth.prototype.getMembership = function (id, cb) {
  var self = this
  var d = duplexify.obj()
  self._lock(function (release) {
    var r = self.db.createReadStream({
      gt: MEMBER_GROUP + id + '!',
      lt: MEMBER_GROUP + id + '!\uffff'
    })
    var out = through.obj(function (row, enc, next) {
      var parts = row.key.split('!')
      var id = parts[1]
      var group = parts[2]
      next(null, Object.assign({ id: group }, row.value))
    })
    pump(r, out)
    if (typeof cb === 'function') {
      collect(out, function (err, groups) {
        cb(err, groups)
      })
    }
    d.setReadable(out)
    release()
  })
  return d
}

Auth.prototype.getMemberHistory = function (id, cb) {
  var self = this
  var d = duplexify.obj()
  self._lock(function (release) {
    var r = self.db.createReadStream({
      gt: MEMBER_HISTORY + id + '!',
      lt: MEMBER_HISTORY + id + '!\uffff'
    })
    var out = through.obj(function (row, enc, next) {
      var parts = row.key.split('!')
      var group = parts[2]
      var key = parts[3]
      next(null, { group, key })
    })
    pump(r, out)
    if (typeof cb === 'function') {
      collect(out, function (err, groups) {
        cb(err, groups)
      })
    }
    d.setReadable(out)
    release()
  })
  return d
}

Auth.prototype.getGroupHistory = function (group, cb) {
  var self = this
  var d = duplexify.obj()
  var gt, lt
  if (typeof group === 'object') {
    if (group.id) {
      gt = GROUP_HISTORY + group.group + '!' + group.id + '!'
      lt = GROUP_HISTORY + group.group + '!' + group.id + '!\uffff'
    } else {
    gt = GROUP_HISTORY + group.group + '!'
    lt = GROUP_HISTORY + group.group + '!\uffff'
    }
  } else {
    gt = GROUP_HISTORY + group + '!'
    lt = GROUP_HISTORY + group + '!\uffff'
  }
  self._lock(function (release) {
    var r = self.db.createReadStream({ gt, lt })
    var out = through.obj(function (row, enc, next) {
      var parts = row.key.split('!')
      var id = parts[2]
      var key = parts[3]
      next(null, { id, key })
    })
    pump(r, out)
    if (typeof cb === 'function') {
      collect(out, function (err, groups) {
        cb(err, groups)
      })
    }
    d.setReadable(out)
    release()
  })
  return d
}
