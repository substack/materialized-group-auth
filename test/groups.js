var test = require('tape')
var memdb = require('memdb')
var mauth = require('../')

test('groups', function (t) {
  t.plan(11)
  var auth = mauth(memdb())
  var docs = [
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
  auth.batch(docs, function (err) {
    t.ifError(err)
    auth.listGroups(function (err, groups) {
      t.ifError(err)
      t.deepEqual(groups.sort(byId), [ { id: '@' }, { id: 'cool' } ])
    })
    auth.listMembers('cool', function (err, members) {
      t.ifError(err)
      t.deepEqual(members.sort(byId), [
        { id: 'user1', role: 'mod' },
        { id: 'user2' }
      ])
    })
    auth.listMembership('user0', function (err, groups) {
      t.ifError(err)
      t.deepEqual(groups.sort(byId), [ { id: '@', role: 'admin' } ])
    })
    auth.listMembership('user1', function (err, groups) {
      t.ifError(err)
      t.deepEqual(groups.sort(byId), [ { id: 'cool', role: 'mod' } ])
    })
    auth.listMembership('user2', function (err, groups) {
      t.ifError(err)
      t.deepEqual(groups.sort(byId), [ { id: 'cool' } ])
    })
  })
})

function byId (a, b) {
  return a.id < b.id ? -1 : +1
}
