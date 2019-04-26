var test = require('tape')
var memdb = require('memdb')
var mauth = require('../')

test('groups', function (t) {
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
      id: 'user2'
    }
  ]
  auth.batch(docs, function (err) {
    t.ifError(err)
    auth.getGroups(function (err, groups) {
      t.ifError(err)
      t.deepEqual(groups.sort(byId), [ { id: '@' }, { id: 'cool' } ])
    })
    auth.getMembers('cool', function (err, members) {
      t.ifError(err)
      t.deepEqual(members.sort(byId), [
        { id: 'user1', role: 'mod' },
        { id: 'user2' }
      ])
    })
    auth.getMembership('user0', function (err, groups) {
      t.ifError(err)
      t.deepEqual(groups.sort(byId), [ { id: '@', role: 'admin' } ])
    })
    auth.getMembership('user1', function (err, groups) {
      t.ifError(err)
      t.deepEqual(groups.sort(byId), [ { id: 'cool', role: 'mod' } ])
    })
    auth.getMembership('user2', function (err, groups) {
      t.ifError(err)
      t.deepEqual(groups.sort(byId), [ { id: 'cool' } ])
    })
    auth.getGroupHistory('cool', function (err, docs) {
      t.ifError(err)
      t.deepEqual(docs, [
        { key: '1001', id: 'user1' },
        { key: '1002', id: 'user2' }
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
    auth.getGroupHistory({ group: 'cool', id: 'user2' }, function (err, docs) {
      t.ifError(err)
      t.deepEqual(docs, [ { key: '1002', id: 'user2' } ])
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
    auth.getMemberHistory('user2', function (err, history) {
      t.ifError(err)
      t.deepEqual(history, [ { group: 'cool', key: '1002' } ])
    })
  })
})

function byId (a, b) { return a.id < b.id ? -1 : +1 }
