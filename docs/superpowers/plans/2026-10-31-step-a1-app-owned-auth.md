# Step A1: app-owned auth, explicit tenant, staff instance

**Spec:** `docs/superpowers/specs/2026-10-31-framework-completion-design.md` (rule 1 and rule 3, Step 1).

## Packages

- **`@tatara/auth`**
  - `createAuthInstance(options, { resolvers?, orgs? })` returns:
    - `auth`: the real `betterAuth(options)`, with its type inferred;
    - `attachPrincipal`: the session principal, then the resolvers;
    - `requireOrg()`.
  - `requireOrg()` takes the org from the `x-org-id` header, falling back to the session's active org. It checks the member row, sets `principal.orgId` and `principal.orgRole`, and answers 400 `ORG_REQUIRED` or 403 for a non-member.
  - `Principal` gains `orgRole: string | null`.
- **`@tatara/authz`**
  - `createAuthz({ singleTenant? })`. Without `singleTenant`, a check with no org answers 400 `ORG_REQUIRED`; there is no default-org fallback.
  - `principal.orgRole` counts as an implied role when it matches a built-in role key.
  - `authzOrganizationHooks(authz)` returns `{ afterRemoveMember }`, to spread into better-auth's `organization({ organizationHooks })`.

## Templates

- **`src/modules/users/`:**
  - `services/auth.ts`: the app's options through `createAuthInstance`, exporting `auth`, `attachPrincipal` and `requireOrg`. Features add their parts to its slots.
  - `services/adapter.ts`, `services/delivery.ts`, `services/sms.ts` and (with Keycloak) `services/keycloak.ts`.
  - `db/seed.ts` and the Drizzle `db/*.schema.ts`.
  - `routes/me.routes.ts`, and `commands/keycloak-token.ts` with Keycloak.
- **`src/modules/staff/`** (admin add-on, with better-auth):
  - a second instance with `modelName`s `staffUser`, `staffSession`, `staffAccount`, `staffVerification`, and its own tables;
  - its own dev-admin seed;
  - mounted at `/api/auth` on the admin app only;
  - its own authz with `singleTenant: "platform"` for platform permissions.
  - The admin app's principal comes from the staff instance.
- **`src/apps/http.ts`** (moved from `src/core/http/app.ts`) is the composition root. It mounts each app's auth handler and principal, then the generated routes. Core no longer imports any auth.
- **Wiring tests** move to `tests/tatara/*.test.ts`. `isFrameworkTest` also matches that folder.

## Codemod 0.10.0: `app-owned-auth`

All or nothing:
- Unchanged files move to their new paths: they're rendered from this CLI and the old copies removed.
- `#core/auth/*` imports are rewritten to `#modules/users/services/*`. Importers of names that moved or changed are blockers.
- A customised `auth.ts` or `app.ts` blocks the move (it's reported and retried on the next upgrade).
- The staff module is new code written for admin apps. Its tables need a migration, so the report says to run `tatara db generate`.

## Verified by

- Package unit tests.
- Codemod fixture tests.
- The full e2e matrix.
- MeemAin regenerated on it.
