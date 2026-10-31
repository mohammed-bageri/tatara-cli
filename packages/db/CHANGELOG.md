# @tatara/db

## 0.1.1

### Patch Changes

- b9ff8c7: `tatara eject <package> [--with-dependents]` copies a package's source into `src/ejected/<name>` and points the app's imports at it. After that, `tatara upgrade`, `sync` and the generators use the app's copy. Library packages now ship their `src` (without tests), so they can be ejected.
- Updated dependencies [b9ff8c7]
  - @tatara/core@0.1.1
