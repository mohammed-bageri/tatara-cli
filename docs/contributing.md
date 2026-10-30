# Contributing

## How an app is rendered

1. Options (`--orm`, `--db`, `--auth`, …) are validated and turned into an ordered list of
   feature ids (`src/engine/resolve.ts`).
2. Each feature (`src/features/*.ts`) may contribute template files, dependencies, scripts,
   env variables, compose services and slot contents.
3. Template files are copied from `templates/features/<id>/files/`, plus every
   `files+<a>+<b>/` folder whose features are all selected. There are no conditionals inside
   template files: a variant is a separate file in a conditional folder.
4. Shared files contain marker lines (`// tatara:slot <name>`, `# …`, `<!-- … -->`). Features
   contribute lines to slots; markers are always removed, so every template file stays valid,
   lintable code. Identical contributions are inserted once.
5. Generated files: `package.json` (versions from `templates/versions.json`), `src/core/config/env.ts`,
   `.env.example` / `.env` / `.env.test`, `compose.yaml`, `pnpm-workspace.yaml`, `tatara.json`.

Tokens replaced in template text: `__APP_NAME__`, `__APP_DB__`, `__PM_RUN__`, `__PM_EXEC__`,
`__BIOME_VERSION__`. Generators also replace `__name<Case>__` and `__module<Case>__`
(`Kebab`, `Pascal`, `Camel`, `Snake`, `Title`, `PluralKebab`, …).

## Adding a feature

1. Add `src/features/<file>.ts` exporting a `Feature` and register it in `src/features/index.ts`.
2. Add `templates/features/<id>/files/…` (and conditional `files+…` folders).
3. Wire it into `selectedFeatureIds` and the prompts/flags in `src/commands/new.ts`.
4. Add a scenario to `e2e/scenarios.ts` and run `pnpm e2e --only <scenario>`.

## Rules

- Every combination must pass the generated app's own `verify` and the e2e smoke test.
- Generators only add files and never overwrite.
- Template code follows the same rules it generates (AGENTS.md in the app).

## Packages

See [packages.md](packages.md) for creating a `@tatara/*` library package and the rules it must follow.
