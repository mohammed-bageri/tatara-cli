---
"@tatara/authz": minor
"@tatara/notifications": minor
"@tatara/core": patch
"@tatara/observability": minor
"@tatara/cli": minor
"create-tatara": minor
---

`authz.grantSystemRole(orgId, userId, key)`; generated apps with organizations make an org's creator its `admin` in their own `auth.ts` (and `authzOrganizationHooks` takes `creatorRole`). The notifier takes `allow({ userId, notification, channel, data })`, so the app decides who gets which channel. `sanitizeHtml` (`@tatara/core/html`, with `sanitize-html` installed). `tatara add <add-on…>` adds add-ons to an existing app. Observability registers in-thread ESM hooks (`module.registerHooks`) where Node has them, so Node 26 prints no deprecation; `@tatara/observability/hooks`.
