var test = require('tape')
var memdb = require('memdb')
var mauth = require('../')

test('disallowed', function (t) {
  t.plan(2)
  var auth = mauth(memdb())
  var pre = [
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
  auth.batch(pre, function (err) {
    t.error(err)
    auth.batch(fail0, function (err) {
      t.ok(err, 'expected set 0 to fail')
    })
  })
})

function byId (a, b) {
  return a.id < b.id ? -1 : +1
}
