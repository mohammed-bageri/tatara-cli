import { definePermissions } from "#core/authz/catalog";

export default definePermissions({
	resources: {
		"__nameKebab__": {
			read: { scoped: false },
		},
	},
	roleGrants: {
		admin: [["__nameKebab__", "read"]],
		member: [["__nameKebab__", "read"]],
	},
});
