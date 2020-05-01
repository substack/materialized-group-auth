# materialized-group-auth

materialize a group authentication database from ordered logs

# example

This example sets up an auth database.

In a real setting you would probably write the log messages to an append-only
log store such as hypercore.

``` js
var mauth = require('materialized-group-auth')
var db = require('level')('/tmp/auth.db')
var auth = mauth(db)

var minimist = require('minimist')
var argv = minimist(process.argv.slice(2))

if (argv._[0] === 'write') {
  var doc = {
    type: argv.type,
    key: argv.key,
    by: argv.by || null,
    role: argv.role,
    group: argv.group,
    id: argv.id
  }
  auth.batch([doc], function (err) {
    if (err) console.error(err)
  })
} else if (argv._[0] === 'groups') {
  auth.getGroups(function (err, groups) {
    if (err) return console.error(err)
    groups.forEach((group) => console.log(group))
  })
} else if (argv._[0] === 'members') {
  auth.getMembers(argv._[1], function (err, members) {
    if (err) return console.error(err)
    members.forEach((member) => console.log(member))
  })
} else if (argv._[0] === 'membership') {
  auth.getMembership(argv._[1], function (err, groups) {
    if (err) return console.error(err)
    groups.forEach((groups) => console.log(groups))
  })
}
```

```
$ node auth.js write --type=add --key=1000 \
  --group=@ --id=user0 --role=admin
$ node auth.js write --type=add --key=1001 \
  --group=cool --id=user1 --role=mod --by=user0
$ node auth.js write --type=add --key=1002 \
  --group=cool --id=user2 --by=user1
$ node auth.js groups
{ id: '@' }
{ id: 'cool' }
$ node auth.js members cool
{ id: 'user1', role: 'mod', key: 1001 }
{ id: 'user2', key: 1002 }
$ node auth.js members @
{ id: 'user0', role: 'admin', key: 1000 }
```

# api

``` js
var mauth = require('materialized-group-auth')
```

## var auth = mauth(db)

Create an `auth` instance from a levelup instance `db`.

## auth.batch(docs, opts={}, cb)

Batch-insert an array of operations `docs`. All the operations in `docs` must be
valid for any records to be written.

When `opts.skip` is `true`, batches will always succeed and invalid operations
will be silently ignored. This is a good setting if you build materialized views
from log data from external sources such as gossip. Otherwise the batch size
would affect the final state if there are invalid records.

Each `doc` in the `docs` batch should be one of these types:

### add

* type: 'add'
* key - string to refer to a document from the log
* group - group string name
* id - user id string to add
* by - user added by this user id string
* role - when specified, add the user as this role

### remove

* type: 'remove'
* key - string to refer to a document from the log
* group - group string name
* id - user id string to add
* by - user removed by this user id string

If `by` is `null`, the operation will always succeed.

* Users who have `role='mod'` can add and remove users without roles set.
* Users who have `role='admin'` can add and remove mods and users without roles.

The group `@` is special: members of this group are allowed to administer any
other group. Inside the `@` group, mod/admin policies apply for adminsitration.

## auth.isMember({ group, id }, cb)

Determine whether a user `id` is a member of `group` as `cb(err, isMember)` for
a boolean `isMember`.

## auth.getRole({ group, id }, cb)

Get the role as a string in `cb(err, role)` for an `id` in a `group`.

## var rstream = auth.getGroups(cb)

Return a list of all the groups in the database as `cb(err, groups)` or a
readable object stream `rstream` where each row is of the form:

* `row.id` - group name string

## var rstream = auth.getMembers(group, cb)

Return a list of all the members in a `group` as `cb(err, members)` or a
readable object stream `rstream` where each row is of the form:

* `row.id` - id string of the group user
* `row.role` - user role if set
* `row.key` - key to refer to an original document

## var rstream = auth.getMembership(id, cb)

Return a list of all the groups that the user `id` is a member of as
`cb(err, groups)` or a readable object stream `rstream` where each row is of the
form:

* `row.id` - string name of the group
* `row.role` - role of the user in the group, if any
* `row.key` - key to refer to an original document

## var rstream = auth.getMemberHistory(id, cb)

Return a list of the history of a member `id` as `cb(err, history)` or a
readable object stream `rstream` where each row is of the form:

* `row.key` - key of the document in the historical log
* `row.group` - group string name where the event occured

## var rstream = auth.getGroupHistory(group, cb)

Return a list of the history of a `group` as `cb(err, history)` or a readable
object stream `rstream` where each row is of the form:

* `row.id` - id of the user
* `row.key` - key of the document to look up from the historical log

# license

BSD

# install

npm install materialized-group-auth

