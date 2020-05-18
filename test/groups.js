var test = require('tape')
var memdb = require('memdb')
var collect = require('collect-stream')
var mauth = require('../')

test('groups', function (t) {
  t.plan(53)
  var auth = mauth(memdb())
  var docs = [
    {
      key: 1000,
      type: 'add',
      by: null,
      group: '@',
      id: 'user0',
      flags: ['admin']
    },
    {
      key: 1001,
      type: 'add',
      by: 'user0',
      group: 'cool',
      id: 'user1',
      flags: ['mod']
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
        { id: 'user1', flags: ['mod'], key: 1001 },
        { id: 'user2', key: 1002 }
      ])
    })
    auth.getMembership('user0', function (err, groups) {
      t.ifError(err)
      t.deepEqual(groups.sort(byId), [
        { id: '@', flags: ['admin'], key: 1000 }
      ])
    })
    auth.getMembership('user1', function (err, groups) {
      t.ifError(err)
      t.deepEqual(groups.sort(byId), [
        { id: 'cool', flags: ['mod'], key: 1001 }
      ])
    })
    auth.getMembership('user2', function (err, groups) {
      t.ifError(err)
      t.deepEqual(groups.sort(byId), [ { id: 'cool', key: 1002 } ])
    })
    auth.isMember({ id: 'user0', group: '@' }, function (err, x) {
      t.ifError(err)
      t.ok(x, 'user0 is a member of group @')
    })
    auth.isMember({ id: 'user0', group: 'cool' }, function (err, x) {
      t.ifError(err)
      t.notOk(x, 'user0 is not a member of group cool')
    })
    auth.isMember({ id: 'user1', group: 'cool' }, function (err, x) {
      t.ifError(err)
      t.ok(x, 'user1 is a member of group cool')
    })
    auth.isMember({ id: 'user1', group: '@' }, function (err, x) {
      t.ifError(err)
      t.notOk(x, 'user1 is not a member of group @')
    })
    auth.isMember({ id: 'user2', group: 'cool' }, function (err, x) {
      t.ifError(err)
      t.ok(x, 'user2 is a member of group cool')
    })
    auth.isMember({ id: 'user2', group: '@' }, function (err, x) {
      t.ifError(err)
      t.notOk(x, 'user2 is not a member of group @')
    })
    auth.isMember({ id: 'user3', group: 'cool' }, function (err, x) {
      t.ifError(err)
      t.notOk(x, 'user3 is not a member of group cool')
    })
    auth.getFlags({ id: 'user0', group: '@' }, function (err, flags) {
      t.ifError(err)
      t.deepEqual(flags, ['admin'])
    })
    auth.getFlags({ id: 'user1', group: 'cool' }, function (err, flags) {
      t.ifError(err)
      t.deepEqual(flags, ['mod'])
    })
    auth.getFlags({ id: 'user2', group: 'cool' }, function (err, flags) {
      t.ifError(err)
      t.deepEqual(flags, [])
    })
    auth.getFlags({ id: 'user3', group: 'cool' }, function (err, flags) {
      t.ifError(err)
      t.deepEqual(flags, [])
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
    collect(auth.list(), function (err, list) {
      t.error(err)
      t.deepEqual(list, [
        { key: 1000, flags: [ 'admin' ], id: 'user0', group: '@' },
        { key: 1001, flags: [ 'mod' ], id: 'user1', group: 'cool' },
        { key: 1002, id: 'user2', group: 'cool' }
      ])
    })
    auth.list(function (err, list) {
      t.error(err)
      t.deepEqual(list, [
        { key: 1000, flags: [ 'admin' ], id: 'user0', group: '@' },
        { key: 1001, flags: [ 'mod' ], id: 'user1', group: 'cool' },
        { key: 1002, id: 'user2', group: 'cool' }
      ])
    })
  })
})

test('regression: opts.skip does not affect operation correctness', function (t) {
  t.plan(5)

  var auth = mauth(memdb())
  var docs = [
    {
      type: 'add',
      id: 'b9be45ef45a827cd4b1b2a414a46cfa5783ca38044d7360c7d2913db6c3ea5b9',
      group: '@',
      flags: ['admin']
    },
    {
      type: 'add',
      by: 'c0f73ca06138ecddcee96efae5a9a799cc1d133d9c00c47bfc87f85cb4e8defd',
      id: 'e8db822eb0f5ba06cacb0e28e6158a95363492fb32cca79105f2549b8a19a508',
      group: '@',
      flags: ['ban/key']
    },
    {
      type: 'add',
      by: 'b9be45ef45a827cd4b1b2a414a46cfa5783ca38044d7360c7d2913db6c3ea5b9',
      id: 'foobar',
      group: '@',
      flags: ['ban/key']
    }
  ]
  auth.batch(docs, {skip:true}, function (err) {
    t.error(err)
    auth.getFlags({
      group: '@',
      id: 'e8db822eb0f5ba06cacb0e28e6158a95363492fb32cca79105f2549b8a19a508'
    }, function (err, flags) {
      t.error(err)
      t.deepEqual(flags, [])
      auth.getFlags({group:'@', id:'foobar'}, function (err, flags) {
        t.error(err)
        t.deepEqual(flags, ['ban/key'])
      })
    })
  })
})

function byId (a, b) { return a.id < b.id ? -1 : +1 }
