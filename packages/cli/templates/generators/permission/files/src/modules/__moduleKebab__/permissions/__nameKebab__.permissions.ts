import { definePermissions } from "#core/authz/catalog";

export default definePermissions({
	resources: {
		"__nameKebab__": {
			// scoped actions are checked at own | team | org; use resolveScope() in the service
			read: { scoped: true },
			manage: { scoped: false },
		},
	},
	roleGrants: {
		admin: [
			["__nameKebab__", "read", "org"],
			["__nameKebab__", "manage"],
		],
		member: [["__nameKebab__", "read", "own"]],
	},
});
