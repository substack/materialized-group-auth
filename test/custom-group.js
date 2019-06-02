var test = require('tape')
var memdb = require('memdb')
var mauth = require('../')

test('custom group', function (t) {
  t.plan(27)
  var auth = mauth(memdb())
  var docs = [
    {
      key: 1000,
      type: 'add',
      by: null,
      group: '@',
      id: 'user0',
      role: 'admin'
    },
    {
      key: 1001,
      type: 'add',
      by: 'user0',
      group: 'cool',
      id: 'user1',
      role: 'mod'
    },
    {
      key: 1002,
      type: 'add',
      by: 'user1',
      group: 'cool',
      id: 'bot0',
      role: 'bot'
    }
  ]
  auth.batch(docs, function (err) {
    t.ifError(err)
    auth.getGroups(function (err, groups) {
      t.ifError(err)
      t.deepEqual(sortBy('id',groups), [ { id: '@' }, { id: 'cool' } ])
    })
    auth.getMembers('cool', function (err, members) {
      t.ifError(err)
      t.deepEqual(sortBy('id',members), [
        { id: 'bot0', role: 'bot' },
        { id: 'user1', role: 'mod' }
      ])
    })
    auth.getMembership('user0', function (err, groups) {
      t.ifError(err)
      t.deepEqual(sortBy('id',groups), [ { id: '@', role: 'admin' } ])
    })
    auth.getMembership('user1', function (err, groups) {
      t.ifError(err)
      t.deepEqual(sortBy('id',groups), [ { id: 'cool', role: 'mod' } ])
    })
    auth.getMembership('bot0', function (err, groups) {
      t.ifError(err)
      t.deepEqual(sortBy('id',groups), [ { id: 'cool', role: 'bot' } ])
    })
    auth.getGroupHistory('cool', function (err, docs) {
      t.ifError(err)
      t.deepEqual(sortBy('key',docs), [
        { key: '1001', id: 'user1' },
        { key: '1002', id: 'bot0' }
      ])
    })
    auth.getGroupHistory('@', function (err, docs) {
      t.ifError(err)
      t.deepEqual(docs, [ { key: '1000', id: 'user0' } ])
    })
    auth.getGroupHistory({ group: 'cool', id: 'user1' }, function (err, docs) {
      t.ifError(err)
      t.deepEqual(docs, [ { key: '1001', id: 'user1' } ])
    })
    auth.getGroupHistory({ group: 'cool', id: 'bot0' }, function (err, docs) {
      t.ifError(err)
      t.deepEqual(docs, [ { key: '1002', id: 'bot0' } ])
    })
    auth.getGroupHistory({ group: '@', id: 'user0' }, function (err, docs) {
      t.ifError(err)
      t.deepEqual(docs, [ { key: '1000', id: 'user0' } ])
    })
    auth.getMemberHistory('user0', function (err, history) {
      t.ifError(err)
      t.deepEqual(history, [ { group: '@', key: '1000' } ])
    })
    auth.getMemberHistory('user1', function (err, history) {
      t.ifError(err)
      t.deepEqual(history, [ { group: 'cool', key: '1001' } ])
    })
    auth.getMemberHistory('bot0', function (err, history) {
      t.ifError(err)
      t.deepEqual(history, [ { group: 'cool', key: '1002' } ])
    })
  })
})

function sortBy (key, xs) {
  return xs.sort(function (a,b) { return a[key] < b[key] ? -1 : +1 })
}
