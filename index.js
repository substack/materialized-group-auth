var collect = require('collect-stream')
var readonly = require('read-only-stream')
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
}

Auth.prototype.allowed = function (op, cb) {
  // todo: fail if SEPARATOR in name
  cb(null, true)
}

Auth.prototype.batchAllowed = function (batch, cb) {
  cb(null, true)
}

Auth.prototype.batch = function (docs, cb) {
  cb = once(cb)
  var self = this
  var batch = []
  self.batchAllowed(docs, function (err, allowed) {
    if (err) cb(err)
    else if (!allowed) {
      var err = new Error('operation not allowed')
      err.type = 'NOT_ALLOWED'
      return cb(err)
    } else insert()
  })
  function insert () {
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
            var value = { mod: Boolean(doc.mod) }
            if (doc.by) value.addedBy = doc.by
            if (doc.mod && doc.by) value.modBy = doc.by
            batch.push({ type: 'put', key: gmkey, value: value })
            batch.push({ type: 'put', key: mgkey, value: '' })
          }
          if (--pending === 0) done()
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
        if (--pending === 0) done()
      } else cb(null)
    })
    if (--pending === 0) done()
  }
  function done () {
    self.db.batch(batch, cb)
  }
}

Auth.prototype.listGroups = function (cb) {
  var r = this.db.createReadStream({
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
  return readonly(out)
}

Auth.prototype.listMembers = function (group, cb) {
  var r = this.db.createReadStream({
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
  return readonly(out)
}

Auth.prototype.listMembership = function (id, cb) {
  var self = this
  var r = this.db.createReadStream({
    gt: MEMBER_GROUP + id + '!',
    lt: MEMBER_GROUP + id + '!\uffff'
  })
  var out = through.obj(function (row, enc, next) {
    var parts = row.key.split('!')
    var id = parts[1]
    var group = parts[2]
    var gmkey = GROUP_MEMBER + group + '!' + id
    self.db.get(gmkey, function (err, doc) {
      if (err) return next(err)
      else next(null, Object.assign({ id: group }, doc))
    })
  })
  pump(r, out)
  if (typeof cb === 'function') {
    collect(out, function (err, groups) {
      cb(err, groups)
    })
  }
  return readonly(out)
}
