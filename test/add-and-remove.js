var test = require('tape')
var memdb = require('memdb')
var mauth = require('../')

test('add and remove', function (t) {
  t.plan(6)
  var auth = mauth(memdb())
  var add = [
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
      group: '@',
      id: 'user1',
      role: 'ban'
    },
  ]
  var remove = [
    {
      type: 'remove',
      by: 'user0',
      group: '@',
      id: 'user1',
      role: 'ban'
    },
  ]
  auth.batch(add, function (err) {
    t.error(err)
    auth.getMembers('@', function (err, members) {
      t.error(err)
      t.deepEqual(members.sort(byId), [
        { id: 'user0', role: 'admin' },
        { id: 'user1', role: 'ban' },
      ])
      auth.batch(remove, function (err) {
        t.error(err)
        auth.getMembers('@', function (err, members) {
          t.error(err)
          t.deepEqual(members.sort(byId), [
            { id: 'user0', role: 'admin' },
          ])
        })
      })
    })
  })
})

function byId (a, b) {
  return a.id < b.id ? -1 : +1
}
