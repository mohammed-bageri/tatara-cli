/** Built-in roles. Add a key here, then grant it permissions in module permission files. */
export const SYSTEM_ROLES = [
	{ key: "admin", name: "Admin", description: "Full access, including roles and members." },
	{ key: "member", name: "Member", description: "Default role for every member." },
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLES)[number]["key"];
