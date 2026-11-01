# @tatara/core

## 0.1.2

### Patch Changes

- 315003d: Operations. `@tatara/core`: a `deploy` command (commands with `phase: "deploy"` every deploy, `phase: "once"` once per database, recorded in a ledger; `db:migrate` runs first, `authz:sync-permissions` after), `createEncryption` (AES-256-GCM, rotatable keys), `randomCode`/`numericCode`/`randomToken`/`hashToken`/`safeEqual`, and `cleanText`/`safeUrl` with the `text()`/`url()` zod fields. `@tatara/db`: `commandLedger(url)` per driver; a Postgres reset also drops the `tatara` schema. New `@tatara/observability` and `observability` add-on: OpenTelemetry traces and metrics over OTLP/HTTP with auto-instrumentation, Hono request spans, trace ids on log lines, instrumented processes through `--import ./dist/apps/instrument.mjs`. Codemod 0.11.0 `deploy-ledger`.

## 0.1.1

### Patch Changes

- b9ff8c7: `tatara eject <package> [--with-dependents]` copies a package's source into `src/ejected/<name>` and points the app's imports at it. After that, `tatara upgrade`, `sync` and the generators use the app's copy. Library packages now ship their `src` (without tests), so they can be ejected.
