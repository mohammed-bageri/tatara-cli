import type { Feature } from "./types.ts";

const AUTHZ_AGENTS = `## Permissions (authz)

- Permissions are \`resource:action\` (optionally scoped \`own | team | org\`, where a wider scope
  satisfies a narrower one). Each module declares its resources and the grants built-in roles get
  in \`permissions/<name>.permissions.ts\` (\`definePermissions\`); \`tatara sync\` merges them into a
  typed catalog.
- Guard routes with \`middleware: [requirePermission("project:read")]\` from \`#core/authz/middleware\`
  and declare \`security: [{ bearerAuth: ["project:read"] }]\`. For scoped actions, call
  \`resolveScope(principal, "doc:read")\` in the service and filter rows by the returned scope.
- Effective permissions = role grants (assigned roles + built-in roles whose key matches an
  identity-provider role) + grant overlays − deny overlays. Deny always wins.
- Custom roles and grant overlays can never grant \`role\`, \`member\` or \`audit_log\`.
- Built-in roles live in \`src/core/authz/system-roles.ts\`. Run \`__PM_EXEC__ tatara run authz:sync-permissions\`
  on every deploy (it is idempotent); \`db:seed\` runs it locally.
- In tests: \`asUser({ permissions: ["project:read"] })\` or \`asUser({ systemRoles: ["admin"] })\`.
`;

export const authz: Feature = {
	id: "authz",
	kind: "addon",
	label: "Permission system",
	slots: [
		{
			file: "tests/helpers/auth.ts",
			slot: "imports",
			content: 'import { applyTestAccess, type TestAccess } from "#tests/helpers/authz";',
		},
		{
			file: "tests/helpers/auth.ts",
			slot: "options",
			content: 'permissions?: TestAccess["permissions"];\nsystemRoles?: TestAccess["systemRoles"];',
		},
		{
			file: "tests/helpers/auth.ts",
			slot: "options",
			when: ["better-auth"],
			content: "orgId?: string;",
		},
		{
			file: "tests/helpers/auth.ts",
			slot: "as-user",
			content: "await applyTestAccess(user.userId, options);",
		},
		{ file: "AGENTS.md", slot: "sections", content: AUTHZ_AGENTS },
	],
};
