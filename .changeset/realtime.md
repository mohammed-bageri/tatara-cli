---
"@tatara/realtime": minor
"@tatara/cli": minor
"create-tatara": minor
---

`@tatara/realtime`: socket.io with single-use tickets (through the cache), per-user and per-org rooms, module channels (`defineChannel`: a name pattern, `authorize`, zod-checked events), `publishToUser` / `publishToOrg` / `publishTo` from any process (Redis adapter and emitter; a publish has left the process when it resolves), `disconnectUser` / `disconnectOrg`, and a `realtime:publish` command. New `realtime` add-on: `POST /api/realtime/ticket`, the api attaches sockets on its own port (`startServer({ onServer })`), `channels/*.ts` convention, and with notifications every inbox entry is pushed as `notification.created`.
