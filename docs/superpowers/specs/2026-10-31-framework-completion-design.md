# tatara: completing the framework

## Intent

tatara came out of Sana's structure. It should now give any app the standard building blocks Sana needed, and Sana itself should be able to move onto it. Two corrections from building MeemAin come first:

- **The app owns its flows; tatara gives helpers.** Today the app's whole `betterAuth({...})` sits in `src/core`, and features wire authz into it. That forces core to import modules, e.g. MeemAin's guest merge.
- **Nothing hides a tenant.** authz falls back to a "default" org when the session has none.

The rules from `2026-10-30-framework-packages-design.md` still hold: Hono stays Hono, there's no runtime registry, and packages return real library objects and do no work on import.

## New rules

1. **Core is infrastructure config; flows live in modules; apps compose.**
   - `src/core` holds env, logger, db client, storage, email and i18n config, and the authz engine instance. It never imports modules.
   - Auth, the users that go with it, and any domain hook live in a module.
   - `src/apps/*` is the composition root. It may import modules and mounts the auth handler and principal middleware.
2. **Every backing service is a driver behind an interface.**
   - Each package ships an in-process driver for dev and tests, a Postgres driver where that makes sense, and the common hosted options.
   - An app picks its drivers in env. There is no lock-in to Redis, a cloud, or a broker.
   - New apps default to Redis (with a Redis container in dev compose). Postgres and memory are one env change away.
3. **Tenant context is explicit.**
   - A request that acts in an org says which org, and the framework checks membership.
   - Single-tenant apps opt in to a fixed org id. Nothing falls back silently.
4. **Folder conventions, wired by `tatara sync`, for every module contribution:** routes, commands, seeds, permissions, consumers, schedules, notification templates, realtime channels. This is static, in `src/generated`, and visible.
5. **Learn from Sana, don't copy it.** Sana's core imports modules in authz, email, storage, realtime and the HTTP middleware. It also runs two outbox pipelines and keeps channel APIs that nobody uses. tatara keeps one of each, and layers them correctly.

## Steps

Each step is one release, one codemod, the full e2e matrix, a review, and MeemAin moving onto it.

| # | Step | What changes |
|---|---|---|
| 1 | **App-owned auth, explicit tenant** | See "Step 1" below. |
| 2 | **`@tatara/cache`** | A KV interface: `get/set/del/increment/wrap/lock`. Drivers: memory, Postgres (unlogged table + advisory locks), Redis. Used by rate limits and schedule locks, and by apps directly (tenant/user key helpers from Sana). |
| 3 | **HTTP gaps** | `rateLimit({ store, key, window, max })` on top of cache, with an i18n 429. Cursor pagination (`cursorQuery`, `cursorPage`, encode/decode). CORS origin patterns for wildcard tenant subdomains. Per-path timeouts. A `startServer` `onServer` hook so realtime can attach. `tatara contracts` writes `openapi.json` + generated TS types (`openapi-typescript`) for typed frontends that use `openapi-fetch`. This replaces Sana's Hono RPC `ApiContract`. |
| 4 | **Jobs v2** (`@tatara/jobs`) | One queue interface with drivers inline (dev/tests), Postgres (`SKIP LOCKED`, which doubles as a transactional outbox when enqueued with the caller's executor), BullMQ (the default), and Kafka (a consumer group per app). Retries with backoff, a dead-letter step that runs only after the last attempt, payload validation through the consumer's zod schema, and a standard `orgId` in the job envelope. Schedules can run in-process (`apps/cron`) or be triggered from outside (`tatara run schedule:<name>`, or an HTTP trigger), so a platform scheduler works anywhere. `forEachOrg` covers per-tenant schedules. |
| 5 | **Notifications** (`@tatara/notifications`, `@tatara/email` v2) | `notify({ orgId, to: user, users, role or permission, template, data, channels })`. It writes an in-app record (app-owned table) and delivers by email, SMS, push and realtime through jobs: one outbox for everything. Templates are a module convention (`notifications/*.ts`, `emails/*.ts`). Drivers: email SMTP / Mailgun / console; SMS Twilio / console; push FCM / console. |
| 6 | **Realtime** (`@tatara/realtime`) | Ticket auth (single-use, through cache), automatic rooms per user and org, module channels (`channels/*.ts`: name pattern, `authorize`, zod events). `publishToUser`, `publishToOrg`, `publishTo(channel)`, and disconnect by user or org. Drivers: socket.io with an adapter (memory or Redis; a Postgres LISTEN/NOTIFY adapter is possible later), or noop. Other processes publish through the adapter. |
| 7 | **Operations** | `@tatara/observability` (OpenTelemetry init/shutdown, Hono middleware, OTLP). Crypto helpers in `@tatara/core` (token encryption with a key from env, OTP and codes). A command ledger (`kind: "deploy"` runs every deploy, `"once"` runs once per database). Text sanitizers. |

For Sana's migration, later: an AI client (providers with fallback, pricing, JSON parsing), billing entitlements (a registry of features and limits), and a Kafka driver for jobs. These are recorded here, not built now.

## Step 1 in detail

**Packages**
- `@tatara/auth` gains `createAuthInstance(options, { resolvers })`. It returns `{ auth, attachPrincipal, handler }`. `auth` is the real better-auth instance, and resolvers add other credential kinds, e.g. Keycloak.
- `requireOrg({ header?, cookie? })` takes the org from the request (an `X-Org-Id` header by default), checks membership through the auth instance, and sets `principal.orgId` and `principal.orgRole`.
- `@tatara/authz`:
  - `orgOf` throws when there's no org.
  - `createAuthz({ singleTenant: "<id>" })` is the explicit opt-in for single-tenant apps.
  - `authzOrganizationHooks(authz)` gives an app the better-auth hooks (member removed → access removed) to pass in its own config.

**Generated app** (Sana's layout)
- `src/modules/users/` owns `auth.ts` (the app's better-auth options for its users, through `createAuthInstance`), delivery, `GET /me`, and the user-related permissions. Domain hooks, like MeemAin's guest merge, live there or in modules it calls.
- With the admin add-on, `src/modules/staff/` owns a second instance for internal staff:
  - its own better-auth options, tables (`staff_users`, `staff_sessions` and so on, through better-auth's model names) and dev-admin seed;
  - its own `/api/auth` mount on the admin app;
  - platform permissions checked by the admin app.
  - Staff and customer accounts never share a table.
- `src/apps/http.ts` (moved from `src/core/http/app.ts`) builds every HTTP app. It mounts the module's auth handler and principal middleware, then the generated routes.
- `src/core/authz/index.ts` creates the engine. Its hooks go into the accounts module's auth config, written by the app.

**Codemod:** moves unchanged files to their new places; a customised `auth.ts` is moved by hand (reported).

## Questions for the user

Decided in conversation:
- follow Sana's split, with tatara providing helpers;
- jobs, scheduler, notifications and websockets are in scope;
- no lock-in.

Decided after:
- `users` plus optional `staff` modules (Sana's layout, with plural module names like every other module);
- contracts generated from OpenAPI;
- Redis-first default drivers;
- a Kafka driver in step 4.

## Status (2026-11-01)

Step 1 released as 0.10.0. Steps 2–7 are built and release together as 0.11.0 (PRs #14–#19), once the new packages (`cache`, `notifications`, `realtime`, `observability`) have their first publish.

Calls made while building, beyond the table above:
- Kafka through kafkajs (what Sana runs); delayed jobs wait in their own consumer group.
- Schedules claim a tick (`add` with a TTL) rather than lock it for the run, so a late process or a retried trigger can't run it twice.
- The Postgres drivers (cache, jobs, ledger) keep their tables in a `tatara` schema, outside ORM migrations; on MySQL the ledger is an app-owned table.
- Notifications claim each channel with a conditional update before sending: at most once per recipient, never twice.
- `enqueue` and `sendTemplate` are typed from the generated lists, imported as types only, so core never loads module code.
- Library changes peered by other packages (core, http, db, authz) ship as patches, so changesets doesn't force majors on their dependents.
- Not built: per-user notification preferences, an HTML sanitizer, and `owner` → `admin` role mapping (needs a decision).
