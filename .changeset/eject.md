---
"@tatara/cli": minor
"create-tatara": minor
"@tatara/core": patch
"@tatara/http": patch
"@tatara/db": patch
"@tatara/testing": patch
"@tatara/auth": patch
"@tatara/keycloak": patch
---

`tatara eject <package> [--with-dependents]` copies a package's source into `src/ejected/<name>` and points the app's imports at it. After that, `tatara upgrade`, `sync` and the generators use the app's copy. Library packages now ship their `src` (without tests), so they can be ejected.
