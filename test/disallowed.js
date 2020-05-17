var test = require('tape')
var memdb = require('memdb')
var mauth = require('../')

test('disallowed', function (t) {
  t.plan(5)
  var auth = mauth(memdb())
  var pre = [
    {
      type: 'add',
      by: null,
      group: '@',
      id: 'user0',
      flags: ['admin']
    },
    {
      type: 'add',
      by: 'user0',
      group: 'cool',
      id: 'user1',
      flags: ['mod']
    },
    {
      type: 'add',
      by: 'user1',
      group: 'cool',
      id: 'user2'
    }
  ]
  var fail0 = [
    {
      type: 'remove',
      by: 'user2',
      group: 'cool',
      id: 'user1'
    }
  ]
  var fail1 = [
    {
      type: 'add',
      by: 'user2',
      group: 'cool',
      id: 'user3'
    }
  ]
  var fail2 = [
    {
      type: 'add',
      by: 'user2',
      group: 'cool',
      id: 'user3',
      flags: ['custom']
    }
  ]
  var fail3 = [
    {
      type: 'add',
      by: 'user1',
      group: 'cool',
      id: 'user0',
      flags: ['ban']
    }
  ]
  auth.batch(pre, function (err) {
    t.error(err)
    auth.batch(fail0, function (err) {
      t.ok(err, 'expected set 0 to fail')
    })
    auth.batch(fail1, function (err) {
      t.ok(err, 'expected set 1 to fail')
    })
    auth.batch(fail2, function (err) {
      t.ok(err, 'expected set 2 to fail')
    })
    auth.batch(fail3, function (err) {
      t.ok(err, 'expected set 3 to fail')
    })
  })
})

function byId (a, b) {
  return a.id < b.id ? -1 : +1
}
