# Library packages (`@tatara/*`)

Framework code that used to be copied into every app lives in packages under `packages/`.
Apps install only the packages for the features they use.

## Create one

```sh
pnpm new-package http --peer hono --peer @hono/zod-openapi
```

This writes `packages/<name>/` with `package.json`, `tsconfig.json`, `tsdown.config.ts`
(using `libraryConfig()` from `tsdown.base.ts`), `src/index.ts`, a first test and a README.

## Conventions

`packages/conventions.test.ts` checks every library package (everything except `cli` and
`create-tatara`):

| Field | Rule |
|---|---|
| `name` | `@tatara/<dir>` |
| `type` | `"module"` |
| `exports` | `"."` with `types` and `import` under `./dist/` |
| `files` | exactly `["dist"]` |
| `sideEffects` | `false`: importing a package does no work |
| `publishConfig.access` | `"public"` |
| `repository.directory` | `packages/<dir>` |
| `engines.node` | `">=24"` |
| `dependencies` | never `hono`, `@hono/zod-openapi`, `better-auth`, `prisma`, `@prisma/client`, `drizzle-orm` or `zod` |

**Libraries the app owns are peers.** Hono, better-auth, Prisma, Drizzle and Zod are
`peerDependencies` (and `devDependencies` for the package's own tests). The app picks their
versions, and there is only one copy of each in its install.
