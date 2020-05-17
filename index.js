var collect = require('collect-stream')
var duplexify = require('duplexify')
var mutexify = require('mutexify')
var through = require('through2')
var pump = require('pump')
var once = require('once')
var { EventEmitter } = require('events')

var SEP = '!'
var GROUP = 'g!'
var GROUP_MEMBER = 'gm!'
var MEMBER_GROUP = 'mg!'
var GROUP_HISTORY = 'gh!'
var MEMBER_HISTORY = 'mh!'
var ADMIN_GROUP_HISTORY = 'ag!'
var ADMIN_MEMBER_HISTORY = 'am!'

var dbOpts = {
  keyEncoding: 'string',
  valueEncoding: 'json'
}

module.exports = Auth

function Auth (db) {
  if (!(this instanceof Auth)) return new Auth(db)
  this.db = db
  this._lock = mutexify()
}
Auth.prototype = Object.create(EventEmitter.prototype)

Auth.prototype._batchAllowed = function (batch, cb) {
  var self = this
  cb = once(cb)
  var pending = 1
  var invalid = {}
  batch.forEach(function (doc, i) {
    if (doc.by === null) {
      pending++
      return onByRole(null, null)
    }
    if (typeof doc.by !== 'string') return (invalid[i] = true)
    if (typeof doc.id !== 'string') return (invalid[i] = true)
    if (typeof doc.group !== 'string') return (invalid[i] = true)
    if (doc.by.indexOf(SEP) >= 0) return (invalid[i] = true)
    if (doc.id.indexOf(SEP) >= 0) return (invalid[i] = true)
    if (doc.group.indexOf(SEP) >= 0) return (invalid[i] = true)
    if (doc.type === 'add' || doc.type === 'remove') {
      pending++
      self._getRole({ batch, i }, doc.group, doc.by, onByRole)
    }

    function onByRole (err, byRole) {
      // check if initiator of op is a mod
      if (err) return cb(err)
      if (doc.by !== null && byRole !== 'admin' && byRole !== 'mod') {
        invalid[i] = true
        if (--pending === 0) done()
        return
      }
      self._getRole({ batch, i }, doc.group, doc.id, function (err, role) {
        if (err) return cb(err)
        if (doc.role !== null && byRole === 'mod'
        && (role === 'mod' || role === 'admin')) {
          invalid[i] = true
        }
        if (--pending === 0) done()
      })
    }
  })
  if (--pending === 0) done()
  function done () { cb(null, Object.keys(invalid)) }
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
    } else this.db.get(GROUP_MEMBER + '@!' + id, dbOpts, onroot)
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
  } else this.db.get(GROUP_MEMBER + group + '!' + id, dbOpts, onget)

  function onget (err, res) {
    if (err && !err.notFound) return cb(err)
    else if (res && res.role === 'admin') role = 'admin'
    else if (res && res.role === 'mod' && role !== 'admin') role = 'mod'
    else if (res && res.role && role === null) role = res.role
    if (--pending === 0) cb(null, role)
  }
  function onroot (err, res) {
    if (err && !err.notFound) return cb(err)
    if (res) role = 'admin'
    if (--pending === 0) cb(null, role)
  }
}

var emptyB = { batch: [], i: 0 }
Auth.prototype.getRole = function (r, cb) {
  if (r.group.indexOf(SEP) >= 0) {
    return process.nextTick(cb, new Error('invalid group name'))
  }
  if (r.id.indexOf(SEP) >= 0) {
    return process.nextTick(cb, new Error('invalid id'))
  }
  this._getRole(emptyB, r.group, r.id, cb)
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

Auth.prototype.batch = function (docs, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  var self = this
  var skipped = null
  cb = once(cb)
  self._lock(function (release) {
    self._batchAllowed(docs, function (err, invalid) {
      if (err) {
        release(cb, err)
      } else if (opts.skip && invalid.length > 0) {
        skipped = []
        invalid.forEach(function (i) {
          skipped.push(docs[i])
          delete docs[i]
        })
        insert(release, filterNoop(docs))
      } else if (invalid.length > 0) {
        var err = new Error('operation not allowed')
        err.type = 'NOT_ALLOWED'
        release(cb, err)
      } else insert(release, filterNoop(docs))
    })
  })
  function insert (release, docs) {
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
        self.db.get(gmkey, dbOpts, function (err, m) {
          if (!m || Boolean(m.mod) !== Boolean(doc.mod)) {
            var value = {}
            if (doc.role) value.role = doc.role
            if (doc.key !== undefined) value.key = doc.key
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
    self.db.batch(batch, dbOpts, function (err) {
      if (skipped) {
        skipped.forEach(function (skip) {
          self.emit('skip', skip)
        })
      }
      docs.forEach(function (doc) {
        self.emit('update', doc)
      })
      release(cb, err)
    })
  }
}

Auth.prototype.getGroups = function (cb) {
  var self = this
  var d = duplexify.obj()
  self._lock(function (release) {
    var r = self.db.createReadStream(Object.assign({
      gt: GROUP,
      lt: GROUP + '\uffff'
    }, dbOpts))
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
    var r = self.db.createReadStream(Object.assign({
      gt: GROUP_MEMBER + group + '!',
      lt: GROUP_MEMBER + group + '!\uffff'
    }, dbOpts))
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

Auth.prototype.isMember = function (r, cb) {
  if (r.group.indexOf(SEP) >= 0) {
    return process.nextTick(cb, new Error('invalid group name'))
  }
  if (r.id.indexOf(SEP) >= 0) {
    return process.nextTick(cb, new Error('invalid id'))
  }
  this.db.get(GROUP_MEMBER + r.group + '!' + r.id, function (err, x) {
    if (err && err.notFound) cb(null, false)
    else if (err) cb(err)
    else cb(null, true)
  })
}

Auth.prototype.getMembership = function (id, cb) {
  var self = this
  var d = duplexify.obj()
  self._lock(function (release) {
    var r = self.db.createReadStream(Object.assign({
      gt: MEMBER_GROUP + id + '!',
      lt: MEMBER_GROUP + id + '!\uffff'
    }, dbOpts))
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
    var r = self.db.createReadStream(Object.assign({
      gt: MEMBER_HISTORY + id + '!',
      lt: MEMBER_HISTORY + id + '!\uffff'
    }, dbOpts))
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
    var r = self.db.createReadStream(Object.assign({ gt, lt }, dbOpts))
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

function has (obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function filterNoop (pre) {
  // remove no-ops but add an index property with the original integer index
  var docs = []
  var removed = {}, added = {}
  for (var i = 0; i < pre.length; i++) {
    var doc = pre[i]
    if (!doc) continue
    if (doc.id === '__proto__' || doc.group === '__proto__') continue
    if (doc.type === 'remove') {
      if (!removed[doc.group]) removed[doc.group] = {}
      removed[doc.group][doc.id] = Math.max(removed[doc.group][doc.id] || 0, i)
    } else if (doc.type === 'add') {
      if (!added[doc.group]) added[doc.group] = {}
      added[doc.group][doc.id] = Math.max(added[doc.group][doc.id] || 0, i)
    }
  }
  for (var i = 0; i < pre.length; i++) {
    var doc = pre[i]
    if (!doc) continue
    if (doc.type === 'add' && removed[doc.group]
    && has(removed[doc.group], doc.id) && removed[doc.group][doc.id] > i) {
      continue // skip docs added before a remove
    }
    if (doc.type === 'remove' && added[doc.group]
    && has(added[doc.group], doc.id) && added[doc.group][doc.id] > i) {
      continue // skip docs removed before an add
    }
    docs.push(doc)
  }
  return docs
}
