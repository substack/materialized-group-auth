var collect = require('collect-stream')
var readonly = require('read-only-stream')
var defaults = require('levelup-defaults')
var through = require('through2')
var pump = require('pump')
var once = require('once')

var GROUP = 'g!'
var MEMBER = 'm!'
var USER = 'u!'
var MOD = '@!'

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
    }
    else insert()
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
        var mkey = MEMBER + doc.group + '!' + doc.id
        self.db.get(mkey, function (err, m) {
          if (!m || Boolean(m.mod) !== Boolean(doc.mod)) {
            var value = { addedBy: doc.by, mod: Boolean(doc.mod) }
            if (doc.mod) value.modBy = doc.by
            batch.push({ type: 'put', key: mkey, value: value })
          }
          if (--pending === 0) done()
        })
      } else if (doc.type === 'del') {
        batch.push({
          type: 'del',
          key: MEMBER + doc.group + '!' + doc.id
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
  console.log('LIST', MEMBER + group)
  var r = this.db.createReadStream({
    gt: MEMBER + group + '!',
    lt: MEMBER + group + '!\uffff'
  })
  var out = through.obj(function (row, enc, next) {
    next(null, Object.assign({
      id: row.key.slice(MEMBER.length + group.length + 1)
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
