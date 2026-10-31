# @tatara/realtime

Part of [tatara](https://github.com/mohammed-bageri/tatara-cli).

socket.io for tatara apps: a client trades a single-use ticket (from an authenticated route) for a
socket bound to its user and org. Every socket joins its user's and org's rooms; module channels
(`defineChannel`) add rooms a client subscribes to after `authorize`. `publishToUser`,
`publishToOrg` and `publishTo(channel)` work from any process (through Redis), and
`disconnectUser` / `disconnectOrg` close sockets when access changes.
