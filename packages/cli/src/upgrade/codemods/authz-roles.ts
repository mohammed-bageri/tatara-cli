import type { Codemod } from "../codemods.ts";

const PATH = "src/core/authz/system-roles.ts";

/** Adds `heldBy` to the role literal `{ key: "<key>", … }`, unless it has one. */
function holdRole(text: string, key: string, heldBy: string): string {
	const start = text.search(new RegExp(`\\{\\s*key:\\s*"${key}"`));
	if (start === -1) return text;
	const end = text.indexOf("}", start);
	if (end === -1) return text;
	const literal = text.slice(start, end);
	if (literal.includes("heldBy")) return text;
	const body = literal.replace(/,?\s*$/, "");
	return `${text.slice(0, start)}${body}, heldBy: "${heldBy}" ${text.slice(end)}`;
}

/** Roles only follow better-auth's member or user role where the app says so (`heldBy`). */
export const authzRoles: Codemod = {
	version: "0.13.0",
	id: "authz-roles",
	description:
		"Built-in roles say who holds them (heldBy); better-auth's member role is membership only",
	async run(ctx) {
		const { config } = ctx.project;
		if (!(config.addons as string[]).includes("authz")) return;
		const text = await ctx.read(PATH).catch(() => undefined);
		if (text !== undefined) {
			let next = holdRole(text, "member", "members");
			next = holdRole(next, "staff", "identity");
			// Keycloak's realm roles are the app's roles: keep honouring them
			if (config.authMethods.includes("keycloak"))
				for (const [, key] of text.matchAll(/\{\s*key:\s*"([^"]+)"/g))
					if (key && key !== "member") next = holdRole(next, key, "identity");
			if (next !== text) await ctx.write(PATH, next);
		}
		ctx.report.notes.push(
			'Built-in roles no longer follow better-auth\'s member role (or the user role, unless the role has heldBy: "identity"). Give access with authz roles (grantSystemRole, assignRole); `member` is held by every member (heldBy: "members").',
		);
		if (config.authMethods.includes("orgs"))
			ctx.report.notes.push(
				'In src/modules/users/services/auth.ts, replace the organizationHooks that grant the creator\'s role and remove member access with authzPlugin(authz, { endpoints: { "/organization/list-members": "member:read", "/organization/get-full-organization": "member:read", "/organization/list-invitations": "member:read" } }) from @tatara/authz/better-auth, after organization(). It also keeps member roles to owner and member.',
			);
	},
};
