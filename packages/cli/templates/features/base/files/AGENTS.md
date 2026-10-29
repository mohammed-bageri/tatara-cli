# __APP_NAME__ — working agreement

Read this before changing code. It applies to people and coding agents alike.

## Definition of done

- A change is done when `__PM_RUN__ verify` exits 0 (lint + layout + typecheck + tests + build).
- Never disable, skip or weaken a test, a type or a lint rule to make it pass. Fix the code.
- Report what you ran and its result, not that something "should work".

## Layout

```
src/apps/<name>/        one folder per process; thin wiring only
src/core/<area>/        shared infrastructure; never imports from modules
src/modules/<module>/   business code, one folder per domain
src/generated/          written by `tatara sync`; never edit or commit
tests/                  shared test helpers and setup
```

A module holds `routes/`, `services/`, `validators/`, and optionally `db/`, `commands/`
and other folders described below. Business logic lives in `services/`: plain functions
with no knowledge of Hono. Routes validate input, call services and shape the response.

Rules enforced by `tatara check` (part of lint):

- Import with `#core/…`, `#modules/…`, `#apps/…`, `#generated/…`, `#tests/…`; no `../` imports.
- `src/core` never imports from `src/modules`.
- A module uses another module only through its `services/`.
- Module routers never call `use("*")`; attach middleware per route or per path.
- `process.env` is read only in `src/core/config/env.ts`.

## Generators

Prefer generators to hand-writing boilerplate; they only add files and never overwrite:

```
__PM_EXEC__ tatara make module <name>
__PM_EXEC__ tatara make resource <name> --module <module>   # CRUD slice
__PM_EXEC__ tatara make route|service|command <name> --module <module>
__PM_EXEC__ tatara run --list            # app commands
__PM_EXEC__ tatara routes                # every route and what protects it
```

## HTTP

- Every route uses `createRoute` from `@hono/zod-openapi`, with request and response schemas.
  Declare request bodies with `jsonBody(schema, description)` (required; a missing body is a 400),
  responses with `jsonContent(...)`.
  The spec is served at `/openapi.json`, the reference UI at `/docs`.
- Responses use the envelope: `success(data)`, `paginated(items, page, pageSize, total)`.
  Errors are thrown as `AppError` subclasses (`NotFoundError`, `ConflictError`,
  `BusinessRuleError`, `ForbiddenError`, …) and become
  `{ success: false, error, code, details }`.
- Route files are `routes/<name>.routes.ts` and default-export `defineRoutes({ app, basePath, router })`.
  They are found automatically; there is no central list to edit.

## Configuration and logging

- Add environment variables to `src/core/config/env.ts` (validated at startup) and to
  `.env.example`. Never read `process.env` elsewhere.
- Log with `c.get("logger")` in requests and `logger` from `#core/logging/logger` elsewhere.
  No `console.*` outside commands and tests.

## Tests

- Tests live next to the code in `src/modules/<module>/tests/`. Use `api` from
  `#tests/helpers/api` to call routes in-process.
- Test behaviour through the public surface (routes, services); mock only external services.

<!-- tatara:slot sections -->
