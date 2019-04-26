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

module.exports = Auth

function Auth (db) {
  if (!(this instanceof Auth)) return new Auth(db)
  this.db = defaults(db, { valueEncoding: 'json' })
  this._lock = mutexify()
}

Auth.prototype._batchAllowed = function (batch, cb) {
  cb(null, true)
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
        self.db.get(gmkey, function (err, m) {
          if (!m || Boolean(m.mod) !== Boolean(doc.mod)) {
            var value = {}
            if (doc.role) value.role = doc.role
            // duplicate data to avoid setting a mutex around responses
            batch.push({ type: 'put', key: gmkey, value: value })
            batch.push({ type: 'put', key: mgkey, value: value })
          }
          if (--pending === 0) done(release, batch)
        })
      } else if (doc.type === 'del') {
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

Auth.prototype.listGroups = function (cb) {
  var self = this
  var d = duplexify()
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

Auth.prototype.listMembers = function (group, cb) {
  var self = this
  var d = duplexify()
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

Auth.prototype.listMembership = function (id, cb) {
  var self = this
  var d = duplexify()
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
