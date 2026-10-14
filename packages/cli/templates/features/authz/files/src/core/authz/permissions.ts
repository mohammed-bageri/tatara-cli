import { definePermissions } from "#core/authz/catalog";

/** Authorization's own resources; only built-in roles may grant them. */
export default definePermissions({
	resources: {
		role: {
			read: { scoped: false },
			create: { scoped: false },
			update: { scoped: false },
			delete: { scoped: false },
		},
		member: {
			read: { scoped: false },
			update: { scoped: false },
		},
		audit_log: {
			read: { scoped: false },
		},
	},
	roleGrants: {
		admin: [
			["role", "read"],
			["role", "create"],
			["role", "update"],
			["role", "delete"],
			["member", "read"],
			["member", "update"],
			["audit_log", "read"],
		],
	},
});
