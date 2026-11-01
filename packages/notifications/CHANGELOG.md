# @tatara/notifications

## 0.1.0

### Minor Changes

- 6bcea69: `@tatara/notifications`: `notify({ orgId, to, notification, data })` for in-app, email, SMS and push. Recipients are a user, users, a role or a permission; delivery goes through jobs (fan-out, then one delivery per user), each channel once per recipient, deduped by `idempotencyKey`. `defineNotification` templates in `notifications/*.ts`, Drizzle and Prisma stores, Twilio and FCM senders (console fallbacks). `@tatara/email`: a Mailgun driver and `defineEmail` templates. New `notifications` add-on (brings jobs and the cache): the inbox routes, push tokens, `SMS_DRIVER`/`PUSH_DRIVER`. Codemod 0.11.0 `email-v2`.

### Patch Changes

- Updated dependencies [315003d]
  - @tatara/core@0.1.2
