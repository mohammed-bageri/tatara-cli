---
"@tatara/cli": minor
"create-tatara": minor
---

Generated apps with the permission system use `@tatara/authz`: `src/core/authz/index.ts` creates the app's `authz` from its store, catalog and built-in roles, and the authorization routes come from the package. The ORM store stays in the app. `tatara upgrade` runs the 0.6.0 `authz-package` codemod.
