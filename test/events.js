var test = require('tape')
var memdb = require('memdb')
var mauth = require('../')

test('events', function (t) {
  t.plan(7)
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
    },
    {
      key: 1003,
      type: 'add',
      by: 'user1',
      group: 'cool',
      id: 'user2',
      role: 'hmm'
    },
    {
      key: 1004,
      type: 'add',
      by: 'user1',
      group: 'cool',
      id: 'user2',
      role: 'whatever'
    },
    {
      key: 1005,
      type: 'add',
      by: 'user2',
      group: 'cool',
      id: 'user2',
      role: 'admin'
    },
  ]
  var expectedUpdates = [
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
    },
    {
      key: 1003,
      type: 'add',
      by: 'user1',
      group: 'cool',
      id: 'user2',
      role: 'hmm'
    },
    {
      key: 1004,
      type: 'add',
      by: 'user1',
      group: 'cool',
      id: 'user2',
      role: 'whatever'
    },
  ]
  var expectedSkips = [
    {
      key: 1005,
      type: 'add',
      by: 'user2',
      group: 'cool',
      id: 'user2',
      role: 'admin'
    },
  ]
  auth.on('update', function (update) {
    t.deepEqual(update, expectedUpdates.shift())
  })
  auth.on('skip', function (skip) {
    t.deepEqual(skip, expectedSkips.shift())
  })
  auth.batch(docs, { skip: true }, function (err) {
    t.ifError(err)
  })
})
