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
      flags: ['admin']
    },
    {
      type: 'add',
      by: 'user0',
      group: '@',
      id: 'user1',
      flags: ['ban']
    },
  ]
  var remove = [
    {
      type: 'remove',
      by: 'user0',
      group: '@',
      id: 'user1',
      flags: ['ban']
    },
  ]
  auth.batch(add, function (err) {
    t.error(err)
    auth.getMembers('@', function (err, members) {
      t.error(err)
      t.deepEqual(members.sort(byId), [
        { id: 'user0', flags: ['admin'] },
        { id: 'user1', flags: ['ban'] },
      ])
      auth.batch(remove, function (err) {
        t.error(err)
        auth.getMembers('@', function (err, members) {
          t.error(err)
          t.deepEqual(members.sort(byId), [
            { id: 'user0', flags: ['admin'] },
          ])
        })
      })
    })
  })
})

test('single-batch add and remove', function (t) {
  t.plan(7)
  var auth = mauth(memdb())
  var add0 = [
    {
      type: 'add',
      by: null,
      group: '@',
      id: 'user0',
      flags: ['admin']
    }
  ]
  var add1 = [
    {
      type: 'add',
      by: 'user0',
      group: '@',
      id: 'user1',
      flags: ['ban']
    }
  ]
  var remove = [
    {
      type: 'remove',
      by: 'user0',
      group: '@',
      id: 'user1',
      flags: ['ban']
    }
  ]
  auth.batch(add0, function (err) {
    t.error(err)
    auth.batch(add1, function (err) {
      t.error(err)
      auth.getMembers('@', function (err, members) {
        t.error(err)
        t.deepEqual(members.sort(byId), [
          { id: 'user0', flags: ['admin'] },
          { id: 'user1', flags: ['ban'] },
        ])
        auth.batch(remove, function (err) {
          t.error(err)
          check()
        })
      })
    })
  })
  function check () {
    auth.getMembers('@', function (err, members) {
      t.error(err)
      t.deepEqual(members.sort(byId), [
        { id: 'user0', flags: ['admin'] },
      ])
    })
  }
})

test('one batch add and remove', function (t) {
  t.plan(3)
  var auth = mauth(memdb())
  var batch = [
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
      group: '@',
      id: 'user1',
      flags: ['ban']
    },
    {
      type: 'remove',
      by: 'user0',
      group: '@',
      id: 'user1',
      flags: ['ban']
    },
  ]
  auth.batch(batch, function (err) {
    t.error(err)
    auth.getMembers('@', function (err, members) {
      t.error(err)
      t.deepEqual(members.sort(byId), [
        { id: 'user0', flags: ['admin'] },
      ])
    })
  })
})


function byId (a, b) {
  return a.id < b.id ? -1 : +1
}
