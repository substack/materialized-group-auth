var test = require('tape')
var memdb = require('memdb')
var mauth = require('../')

test('disallowed single batch 0', function (t) {
  t.plan(1)
  var auth = mauth(memdb())
  var batch = [
    {
      type: 'add',
      by: null,
      group: '@',
      id: 'user0',
      role: 'admin'
    },
    {
      type: 'add',
      by: 'user0',
      group: 'cool',
      id: 'user1',
      role: 'mod'
    },
    {
      type: 'add',
      by: 'user1',
      group: 'cool',
      id: 'user2'
    },
    {
      type: 'remove',
      by: 'user2',
      group: 'cool',
      id: 'user1'
    }
  ]
  auth.batch(batch, function (err) {
    t.ok(err, 'expected set 0 to fail')
  })
})

test('disallowed single batch 1', function (t) {
  t.plan(1)
  var auth = mauth(memdb())
  var batch = [
    {
      type: 'add',
      by: null,
      group: '@',
      id: 'user0',
      role: 'admin'
    },
    {
      type: 'add',
      by: 'user0',
      group: 'cool',
      id: 'user1',
      role: 'mod'
    },
    {
      type: 'add',
      by: 'user1',
      group: 'cool',
      id: 'user2'
    },
    {
      type: 'add',
      by: 'user2',
      group: 'cool',
      id: 'user3'
    }
  ]
  auth.batch(batch, function (err) {
    t.ok(err, 'expected set 0 to fail')
  })
})

function byId (a, b) {
  return a.id < b.id ? -1 : +1
}
