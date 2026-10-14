# Tatara CLI — implementation plan

Spec: `docs/specs/2026-10-14-tatara-cli-design.md`.

## Decisions made while planning

- Feature definitions are TypeScript modules inside `packages/cli/src/features/` (Node does
  not strip types under `node_modules`, so they are bundled with the CLI). File trees live
  in `templates/`, shipped as assets.
- A feature folder may hold `files/` (always) and `files+<a>+<b>/` (only when features `a`
  and `b` are also selected). No conditionals inside template files.
- Exact dependency versions live in one place, `templates/versions.json`, refreshed by
  `pnpm versions:update` from the npm registry.
- better-auth tables are hand-written per ORM and database (no better-auth CLI at
  scaffold time). Initial migrations are generated offline at `tatara new`
  (`drizzle-kit generate`; `prisma migrate diff --from-empty`).
- `tatara verify` and `tatara check` run inside the app so scripts stay
  package-manager independent.
- pnpm apps get `pnpm-workspace.yaml` with `allowBuilds` for packages with install scripts.

## Tasks

1. Monorepo skeleton: pnpm workspace, Biome, TS, Vitest, `packages/cli`, `packages/create-tatara`.
2. Engine: feature resolution (requires/conflicts), file copy with conditional dirs and
   name placeholders, slots, package.json merge, env/compose/.env assembly, `tatara.json`.
3. Base template: api app, core (config, http, logging, errors, responses, OpenAPI, routes),
   cli app, example module, tests, AGENTS.md/CLAUDE.md, Dockerfile, CI workflow.
4. `tatara sync`, `check`, `verify`, `doctor`, `routes`.
5. Database features: postgres, mysql, drizzle, prisma; `core/db`, migrations, seed, test DB per worker.
6. `tatara dev`, `db *`, `run`, `tinker`.
7. Auth: better-auth (methods, orgs/admin) and keycloak (resource server, dev realm, token command).
8. Authz permission system (port of sana's model), both ORMs.
9. Add-ons: jobs (+worker, cron), admin app, storage, email, i18n.
10. Generators: module, resource, route, service, schema, consumer, schedule, command, permission.
11. `new` command with prompts and flags; `create-tatara`.
12. E2E harness and matrix; fix until green.
13. README and docs.
