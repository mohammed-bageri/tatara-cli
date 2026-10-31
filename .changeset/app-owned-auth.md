---
"@tatara/cli": minor
"create-tatara": minor
"@tatara/auth": minor
"@tatara/authz": minor
"@tatara/keycloak": patch
"@tatara/db": patch
---

The app owns its auth. Generated apps keep auth in `src/modules/users` (built with `createAuthInstance`), compose HTTP in `src/apps/http.ts`, and with the admin add-on get a `staff` module with its own better-auth. Requests name their org (`requireOrg()`, `x-org-id`); a Keycloak token's `organization` claim decides which orgs its user may act in; authz has no default org, so single-tenant apps set `singleTenant`. `tatara upgrade` moves existing apps (codemod 0.10.0). The MySQL test reset deletes rows instead of truncating.
