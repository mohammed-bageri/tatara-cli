import { definePermissions } from "#core/authz/catalog";

export default definePermissions({
	resources: {
		"__nameKebab__": {
			read: { scoped: false },
			create: { scoped: false },
			update: { scoped: false },
			delete: { scoped: false },
		},
	},
	roleGrants: {
		admin: [
			["__nameKebab__", "read"],
			["__nameKebab__", "create"],
			["__nameKebab__", "update"],
			["__nameKebab__", "delete"],
		],
		member: [["__nameKebab__", "read"]],
	},
});
