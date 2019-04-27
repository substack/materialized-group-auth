var mauth = require('../')
//var db = require('level')('/tmp/auth.db')
var db = require('levelup')(require('leveldown')('/tmp/auth.db'))
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
