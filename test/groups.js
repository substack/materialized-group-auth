var test = require('tape')
var memdb = require('memdb')
var mauth = require('../')

test('groups', function (t) {
  t.plan(5)
  var auth = mauth(memdb())
  var docs = [
    {
      type: 'add',
      by: null,
      group: '@',
      id: 'user0',
      mod: true
    },
    {
      type: 'add',
      by: 'user0',
      group: 'cool',
      id: 'user1',
      mod: true
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
        { id: 'user1', addedBy: 'user0', modBy: 'user0', mod: true },
        { id: 'user2', addedBy: 'user1', mod: false }
      ])
    })
  })
})

function byId (a, b) {
  return a.id < b.id ? -1 : +1
}
