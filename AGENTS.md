# tatara — working agreement

- Definition of done: `pnpm verify` passes, and for template changes `pnpm e2e --only <affected scenarios>`
  passes (Docker required). Never weaken a test, type or lint rule to get there.
- Templates must stay valid code: use slots and conditional `files+<feature>` folders, never
  conditionals inside a file.
- Dependency versions live only in `packages/cli/templates/versions.json` (`pnpm versions:update`).
- Read `docs/contributing.md` before adding a feature or generator.
