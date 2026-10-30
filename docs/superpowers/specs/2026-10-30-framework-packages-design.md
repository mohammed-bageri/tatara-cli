# tatara: from generated core to framework packages

## Intent

Today `tatara new` copies about 100 files of shared infrastructure (`src/core/*`) into every app. Each app then owns its copy, so a fix has to be made in tatara's templates **and** in every app by hand. This happened eight times in one week with MeemAin, the first real app.

The goal is that tatara becomes a framework: that shared code lives in `@tatara/*` packages, apps import it, and a fix ships as a package release.

What tatara is, in the user's words: **it provides the structure and the tools, and of course the CLI**. Structure and CLI are first-class, not afterthoughts. tatara does **not** sit in front of the libraries it builds on.

## The rules

1. **No wrapping.** Apps use Hono, Prisma or Drizzle, and better-auth directly, with their normal APIs and docs. Every tatara factory returns the real library object; for example, `createHttpApp()` returns an `OpenAPIHono`. An app never needs a tatara release to change a library option.
2. **The core is the framework.** A finished app has no `src/core/` framework code. What it keeps is configuration and its own code (below).
3. **Configure, don't edit.** Where apps differ, packages take options with today's behaviour as the default. Anything an option doesn't cover is done in the app's own library config, e.g. its own `betterAuth({...})`, or by ejecting.
4. **Separate packages, so small apps stay small.** An app installs only the packages for the features it uses. Libraries an app owns (hono, better-auth, prisma, drizzle-orm, zod) are **peer dependencies**, so the app picks their versions and gets one copy of each.
5. **Escape hatch: `tatara eject <package>`.** It copies a package's source into the app and rewrites the imports. From then on the app owns that code, and `tatara upgrade` leaves it alone.
6. **Hono stays Hono.** tatara is not a NestJS-style layer in front of the library. Routes are plain Hono, and nothing is discovered or wired at runtime: `sync` writes plain imports at build time, and packages do no work on import.
7. **Move one layer at a time.** Each step is a release that keeps tatara's `verify` and the full e2e matrix green, and MeemAin moves to it before the next step starts.

## Non-goals and anti-goals

- **Non-goals:**
  - A runtime kernel or kind registry. The previous `tatara-framework` repo had `defineApp` + `KindRegistry` + `app.boot()` in `main.ts`; its own port findings list the two registrations drifting apart. A few of its ideas are kept below.
  - Hiding or re-exporting library APIs.
  - New features. This is a move, not a redesign.
- **Anti-goals.** It's a failure, even if it works, if:
  - an app has to wait for tatara to change a Hono, better-auth or Prisma setting;
  - a minimal app installs auth, S3 or Redis code it doesn't use;
  - a release breaks an existing app with no `tatara upgrade` path;
  - the generated app is harder to read than today.

## What an app looks like at the end

```
src/
  apps/api/server.ts        createHttpApp("api", {...}) + startServer(...)   (thin, generated)
  apps/admin/server.ts
  apps/cli/index.ts
  config/env.ts             createEnv({...}) with the app's variables, using localDefault()
  config/auth.ts            the app's own betterAuth({...}): its plugins, hooks, session rules,
                            plus tatara's (keycloakTokens(), …)
  config/db.ts              the app's Prisma/Drizzle client
  modules/<module>/...      routes, services, validators, permissions, commands, tests (unchanged)
  generated/                written by `tatara sync` (unchanged)
  locales/<lang>.json       the app's strings; package strings are merged in
prisma/models/*.prisma      every table, including auth and authz (owned by the app, so migrations work)
tatara.json                 records features and installed @tatara/* packages
```

*My call: config moves from `src/core/` to `src/config/`. Once `src/core` holds no framework code, the folder name would be misleading.*

## Packages

| Package | Contains (moved from templates `src/core/*`) | Peer deps | Used by |
|---|---|---|---|
| `@tatara/core` | `defineCommand`, `flag()`, command runner, `localDefault()`, lifecycle and shutdown registry, readiness registry, logger options (Cloud Logging format) | zod, pino | every app |
| `@tatara/http` | `createHttpApp`, `createRouter`, `defineRoutes`, `startServer`, error classes + handler, envelope (`success`, `paginated`), `jsonBody`/`jsonContent`/`errorResponses`, validation hook, request context, trusted client IP | hono, @hono/zod-openapi | every app with HTTP |
| `@tatara/testing` | `client()` in-process API helper, per-worker database URLs, `resetDatabase` | vitest | dev dependency |
| `@tatara/prisma`, `@tatara/drizzle` | migrate, truncate/drop helpers, db readiness check, test DB setup | prisma / drizzle-orm | apps with that ORM |
| `@tatara/auth` | principal type + `attachPrincipal`, `requireAuth`, `requireRole`, `mergeAuthOpenApi`, dev outbox, delivery helpers, test helpers (`asUser`, `authenticate`) | better-auth | apps with auth |
| `@tatara/keycloak` | `keycloakTokens()` better-auth plugin, token verification, `keycloakToken()` test signer | better-auth, jose | apps with the keycloak method |
| `@tatara/authz` | permissions catalog types, `definePermissions`, resolver, cache, middleware, services, store interface, built-in roles | hono | apps with authz |
| `@tatara/authz-prisma`, `@tatara/authz-drizzle` | the authz store for each ORM, taking the app's db client | prisma / drizzle-orm | with authz |
| `@tatara/storage` | `storage` (local + S3) | @aws-sdk/client-s3 | storage add-on |
| `@tatara/email` | `sendEmail` (SMTP / console) | nodemailer | email add-on |
| `@tatara/i18n` | `t()`, `detectLanguage`, base error strings (ar, en) | hono | i18n add-on |
| `@tatara/jobs` | queues, consumers, schedules, lock | bullmq, ioredis | jobs add-on |
| `@tatara/cli`, `create-tatara` | as today, plus `upgrade` and `eject` | — | dev dependency |

- Table schemas (auth, authz) stay **app-owned files** (Prisma models or Drizzle schema), because migrations are generated from the app's schema. Packages document the tables they need, and `tatara add`/`new` writes the files. *My call: this keeps "one migration history per app" and doesn't hide Prisma.*
- Packages that are generated per app today, like env, AGENTS.md sections, compose services and `.env` entries, stay as CLI templates. Only runtime code becomes packages.

## How packages fit into an app

These are my calls; the reviewer flagged them as decisions a builder would otherwise have to guess.

- **Configuration comes in as options, never from the environment.**
  - Packages don't read env variables or `process.env`. The app passes values, e.g. `createHttpApp("api", { cors: env.CORS_ORIGINS, bodyLimit: env.BODY_LIMIT_BYTES })` or `keycloakTokens({ issuer, audience })`. That keeps packages testable and the `env-access` rule unchanged.
  - For convenience, each package also exports its env schema piece (e.g. `httpEnv`), which the app spreads into its own `createEnv({...})`.
- **Routes, commands, seeds and permissions that ship in packages are wired in at build time, as today.**
  - Each package lists them in a `"tatara"` field in its `package.json`.
  - `tatara sync` reads that field for the packages recorded in `tatara.json` and writes plain imports into `src/generated/*`, next to the app's own modules.
  - It's static and visible in the generated files. There's no runtime registry.
- **Tests:**
  - **Unit tests move with the code into each package** and run in the package's CI. Package coverage is measured there.
  - **Integration tests** (routes against a real database) **stay in the app templates and the e2e matrix,** because they test how the pieces are wired in an app.
- **Eject and dependencies:**
  - `tatara eject <package>` refuses when another installed `@tatara/*` package depends on it, and lists those dependents. `--with-dependents` ejects the whole chain.
  - This avoids two copies of shared classes (errors, request context) quietly breaking `instanceof` checks.
- **What `upgrade` compares against:**
  - A copied file counts as unchanged if it matches **any released template version** of that file, with templates rendered for the app's own `tatara.json` options. That covers apps like MeemAin, whose fixes later landed in tatara.
  - From step 0 on, `tatara.json` also records the CLI version and file hashes, so later upgrades have an exact baseline.

## Ideas kept from `tatara-framework`

1. **Build-time validation of discovered files.** `sync` checks every discovered file against its convention, e.g. "a route file default-exports `defineRoutes`". A bad file fails `sync` (and so `verify`) with the file, the convention and the rule named.
2. **A metadata manifest.**
   - Next to the static imports, `sync` writes `src/generated/manifest.json` listing routes (with method, path and guard), commands, permissions and seeds, from the app and from installed packages.
   - `tatara routes` and `doctor` read it instead of importing the app. That also fixes `routes` missing the auth endpoints.
3. **Draining on shutdown.** `@tatara/core` adds `waitUntil(promise)`. Shutdown waits for that work (bounded by a timeout), then runs the hooks in reverse order.
4. **One service declaration per package.**
   - A package that needs a backing service exports a declaration for it: `@tatara/prisma` / `@tatara/drizzle` for the database, `@tatara/jobs` for Redis, `@tatara/storage` for S3, `@tatara/email` for Mailpit.
   - The declaration covers the dev container, the health check (shown at `/ready`), the release step (e.g. migrations) and the shutdown hook.
   - The CLI builds compose, readiness and the migrate step from these declarations instead of keeping that knowledge in its own feature files.
5. **A bench to look at, not a gate.** `pnpm bench` compares a generated app with a plain-Hono app. It's run by hand when useful; nothing in CI fails on its numbers.

## Versions and releases

- **Each package has its own version**, released with Changesets. Packages that change together depend on each other with `^` ranges.
- The CLI keeps a compatibility table (today's `templates/versions.json`) of which package versions it scaffolds.
- **Publishing from CI** with npm trusted publishing (GitHub OIDC), so releases don't need a 2FA code pasted by hand. *My call; npm's staged-release approval may still apply, and that's for the user to check in npm settings.*

## `tatara upgrade` and `tatara eject`

- **`tatara upgrade`**:
  1. Bumps the `@tatara/*` packages to the newest versions the CLI supports.
  2. Runs that release's codemods. The harness idea is in the old `tatara-framework`; it gets rebuilt here.
  3. Runs `sync` and then `verify`.
- **First use: moving a generated app onto a package.** For each copied file the package replaces:
  - If it is **unchanged** from the template the app was generated with (compared by content hash), delete it and rewrite `#core/<layer>/…` imports to `@tatara/<package>`.
  - If the app **changed** it, keep it, list it, and show the diff from the template. The person then either moves that change into an option or the app's config, or ejects.
- **`tatara eject <package>`** copies the package's source into `src/ejected/<package>/`, points imports there, and records it in `tatara.json`. After that, `upgrade` skips the package and says so.

## Order

Each step is one release plus MeemAin moving to it.

| Step | What | Why this order |
|---|---|---|
| 0 | Monorepo ready for many packages: shared build/test config, Changesets, CI publish, the codemod harness and `upgrade` skeleton, a manual bench | Everything else depends on it |
| 1 | `@tatara/core` | No dependencies; smallest |
| 2 | `@tatara/http` | Every app uses it; most of this week's fixes were here |
| 3 | `@tatara/testing` + `@tatara/prisma` / `@tatara/drizzle` | Needed by every later package's tests |
| 4 | `@tatara/auth` + `@tatara/keycloak` | Depends on http |
| 5 | `@tatara/authz` + store adapters | Largest; depends on auth |
| 6 | `@tatara/storage`, `@tatara/email`, `@tatara/i18n`, `@tatara/jobs` | Independent add-ons |
| 7 | `tatara eject`; generated apps no longer contain `src/core`; archive `tatara-framework` | The end state |

## How each step is verified

- The package carries the unit tests that live in the templates today, plus any new ones. Coverage must not drop.
- The e2e matrix still passes for all scenarios. Generated apps now import the package instead of a copy.
- A test for the step's codemod: an unmodified app migrates cleanly, and a modified file is kept and reported.
- MeemAin runs `tatara upgrade`, then `verify` passes, then its PR's CI passes.

## Left to the builder

- Package internals, file layout and build tool. tsdown is already used, and should be kept unless there's a reason not to.
- The exact option names for each factory, as long as defaults match today.
- How the codemods are written (AST or text), as long as they're tested.
