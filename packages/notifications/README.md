# @tatara/notifications

Part of [tatara](https://github.com/mohammed-bageri/tatara-cli).

`notify({ orgId, to, notification, data })` stores an in-app notification and sends it by email,
SMS and push, through two jobs (`notifications.fanout`, then one `notifications.deliver` per user).
Recipients are a user, a list, or everyone in the org with a role or permission. Each channel goes
out once per recipient however often a job retries.
