import { invalidateAll } from "#core/authz/cache";
import { SYSTEM_ORG_ID } from "#core/authz/constants";
import { store } from "#core/authz/db/store";
import { validateGrants } from "#core/authz/services/grants";
import { SYSTEM_ROLES } from "#core/authz/system-roles";
import { grantKey } from "#core/authz/types";
import { catalog } from "#generated/permissions";

/** Creates or updates every built-in role so its grants match the code. Idempotent. */
export async function syncSystemRoles(): Promise<{ created: string[]; updated: string[] }> {
	const created: string[] = [];
	const updated: string[] = [];
	for (const meta of SYSTEM_ROLES) {
		const grants = validateGrants(
			(catalog.roleGrants[meta.key] ?? []).map(([resource, action, scope]) => ({ resource, action, scope })),
			{ allowMeta: true },
		);
		const existing = await store.findRoleByKey(SYSTEM_ORG_ID, meta.key);
		if (!existing) {
			await store.createRole({ orgId: SYSTEM_ORG_ID, key: meta.key, name: meta.name, description: meta.description, isSystem: true, grants });
			created.push(meta.key);
			continue;
		}
		const want = new Set(grants.map(grantKey));
		const have = new Set(existing.grants.map(grantKey));
		const same = want.size === have.size && [...want].every((k) => have.has(k));
		if (!same || existing.name !== meta.name || existing.description !== meta.description) {
			await store.updateRole(existing.id, { name: meta.name, description: meta.description, grants });
			updated.push(meta.key);
		}
	}
	if (created.length || updated.length) invalidateAll();
	return { created, updated };
}
