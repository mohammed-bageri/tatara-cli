import { DEFAULT_ORG_ID, SYSTEM_ORG_ID } from "#core/authz/constants";
import { store } from "#core/authz/db/store";
import { addOverlay, assignRole } from "#core/authz/services/members";
import { syncSystemRoles } from "#core/authz/services/sync";
import type { SystemRoleKey } from "#core/authz/system-roles";
import type { PermissionKey } from "#generated/permissions";

export interface TestAccess {
	/** unscoped permissions granted directly (as overlays) */
	permissions?: PermissionKey[];
	/** built-in roles assigned in the org */
	systemRoles?: SystemRoleKey[];
	orgId?: string;
}

export async function applyTestAccess(userId: string, access: TestAccess): Promise<void> {
	const orgId = access.orgId ?? DEFAULT_ORG_ID;
	for (const key of access.permissions ?? []) {
		const [resource = "", action = ""] = key.split(":");
		await addOverlay(null, orgId, userId, { resource, action, effect: "grant" });
	}
	if (access.systemRoles?.length) {
		await syncSystemRoles();
		for (const roleKey of access.systemRoles) {
			const role = await store.findRoleByKey(SYSTEM_ORG_ID, roleKey);
			if (!role) throw new Error(`Unknown built-in role ${roleKey}`);
			await assignRole(null, orgId, userId, role.id);
		}
	}
}
