# Tatara CLI — design

Tatara is a CLI that creates opinionated Hono backends from templates (in the spirit of
create-t3-app) and generates code inside them afterwards. It is not a framework: a
generated app owns all of its code and has no tatara runtime dependency.

## Goals

- `npm create tatara my-app` produces a running Hono API with the chosen database, ORM,
  auth and add-ons, and `pnpm dev` brings up the whole local stack in one command.
- Every supported combination passes the generated app's own `verify`
  (lint + layout + typecheck + tests + build) and boots.
- Generators (`tatara make …`) only add files, and their output passes `verify`.
- All dependencies are the latest stable releases at implementation time.

## Options

| Option | Values |
|---|---|
| ORM | `drizzle`, `prisma` |
| Database | `postgres`, `mysql` |
| Auth | `better-auth`, `keycloak`, `none` |
| better-auth methods | `email-otp`, `phone-otp`, `password`, `orgs` (organization + admin plugins) |
| Add-ons | `authz` (permission system, needs auth), `jobs` (BullMQ + cron), `admin` (second Hono app), `storage`, `email`, `i18n` |
| Package manager | `pnpm`, `npm`, `bun` (as package manager; runtime is always Node 24) |

## Packages

- `create-tatara` — `npm create tatara` entry; delegates to the CLI's `new` command.
- `@tatara/cli` — the `tatara` binary (`new`, `make`, `sync`, `dev`, `run`, `tinker`,
  `db`, `routes`, `doctor`). Installed in every generated app as a devDependency, so
  generator behaviour is pinned per project.

## Template composition

`templates/base` is a valid minimal app. Each option is a folder under
`templates/features/<id>` containing:

- `files/` — copied into the app (paths may contain `__name__` placeholders);
- `feature.json` — `requires`, `conflicts`, package.json fragment, env entries,
  compose services, slot contributions.

Shared files contain comment markers (`// tatara:slot <name>`). Features contribute
lines to slots; the engine inserts them and removes the markers, so template files
remain valid, lintable TypeScript. `tatara.json` in the app records the choices and
template version.

## Generated app

```
src/apps/{api,admin?,worker?,cron?,cli}   one folder per process
src/core/{config,http,logging,db,auth?,authz?,jobs?,storage?,email?,i18n?}
src/modules/<name>/{routes,services,validators,db,consumers,schedules,commands,permissions,tests}
src/generated/   discovery output (gitignored), written by `tatara sync`
```

- Imports use Node subpath imports (`#core/*`, `#modules/*`, `#generated/*`); dev runs
  on Node 24 type stripping; `erasableSyntaxOnly` is on.
- Discovery: `routes/*.routes.ts` default-export `defineRoutes({ app, basePath, router })`;
  `consumers/*.ts`, `schedules/*.ts`, `commands/*.ts`, `permissions/index.ts`, and (Drizzle)
  `db/schema.ts`. `tatara sync` writes `src/generated/{routes,consumers,schedules,commands,permissions,schema}.ts`.
- Layout rules (lint): modules may import core; core never imports modules; modules use
  other modules only through their `services`; no parent-relative imports; no
  `use("*")` in module routers.
- Response contract `{ success: true, data, meta? }` / `{ success: false, error, code, details }`;
  `AppError` subclasses map to 400/401/403/404/409.
- Every route is a `@hono/zod-openapi` route; spec at `/openapi.json`, Scalar UI at `/docs`.
- `verify` = lint + layout + typecheck + test + build.

## CLI commands in an app

`make module|resource|route|service|schema|consumer|schedule|command|permission`,
`sync`, `dev` (compose up --wait → create DBs → migrate → seed → all entrypoints with
watch), `run <command>` / `run --list`, `tinker`, `db generate|migrate|seed|reset|studio`,
`routes`, `doctor`. Generators never overwrite, are feature-aware (from `tatara.json`),
derive names (kebab/pascal/camel/snake/plural), run `sync` + formatter after writing,
and support `--dry-run` and `--json`.

## Auth

One contract in `core/auth`: `c.var.principal` (`userId`, `orgId?`, `roles`, `kind`,
`claims`), `requireAuth()`, `requireRole()`.

- **better-auth**: instance with the ORM adapter, mounted at `/api/auth/*`; cookie
  sessions plus the bearer plugin; plugins per selected method; pluggable `SmsSender`
  (console in dev); dev OTP shortcut for allow-listed identifiers in development only.
  The admin app uses the same users and requires the `admin` role.
- **keycloak**: resource server. Tokens verified with `jose` against the realm JWKS
  (issuer, audience, expiry); realm/client roles → `roles`, `organization` claim →
  `orgId`; local user row created on first request. Compose runs Keycloak with an
  imported dev realm; `tatara run keycloak:token --user <u>` mints a dev token.

## Permission system (authz)

Ported from sana's model: `(resource, action, scope?)`, scopes `org > team > own`;
roles (system in code, custom in DB), multi-role members, grant/deny overlays with
expiry (deny wins); resolver with caching; audit; `/authorization/*` routes;
`sync-permissions` command. All state is in the app DB keyed by `userId` + `orgId`.
Works with better-auth organizations, Keycloak (`orgId` from token, optional role map)
or single-tenant mode (one implicit org). Module permissions are merged by `tatara sync`
into a typed catalog. DB access is isolated in `core/authz/db/` with one implementation
per ORM.

## Local dev and tests

- `pnpm dev` / `dev:down` / `dev:reset`; compose names and ports configurable from `.env`.
- Unit tests without DB; integration tests against real DB/Redis with one database per
  Vitest worker; helpers `cleanDb`, fixtures, `asUser`, `api.*`.
- Generated GitHub Actions CI with service containers running `verify`.

## Testing tatara

Unit tests for the engine; snapshot tests of generated trees; e2e that, per
combination, generates → installs → `verify` → boots → smoke-tests → runs every
generator → `verify` again. Full matrix: 12 core combinations with all add-ons, 4
minimal apps, npm and bun on two combinations each.

## Out of scope (v1)

`tatara add <addon>` on an existing app; a separate staff identity for the admin app;
login UI for Keycloak.
