---
"@tatara/authz": minor
"@tatara/cli": minor
---

Org access belongs to authz; better-auth's member role is membership only.

- `authzPlugin(authz, options)` from `@tatara/authz/better-auth`: the creator of an org gets `admin`, a member removed or leaving loses their authz access, member roles are kept to `owner` and `member`, and `endpoints` puts better-auth's org endpoints behind authz permissions. Generated apps guard the member and invitation lists with `member:read`.
- **Breaking:** built-in roles no longer follow better-auth's member role or user role. `SystemRole.heldBy` says who holds a role without an assignment: `"members"` (every member of the org) or `"identity"` (holders of that identity-provider role, e.g. `staff` or Keycloak roles). An org member's better-auth role `admin` no longer grants authz's `admin`.
- `tatara upgrade` (0.13.0) adds `heldBy` to `member`, `staff`, and, in Keycloak apps, every role; it says how to move `auth.ts` to `authzPlugin`.
