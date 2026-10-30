import { invalidateAll } from "#core/authz/cache";
import { store } from "#core/authz/db/store";
import { audit } from "#core/authz/services/audit";
import { validateGrants } from "#core/authz/services/grants";
import { SYSTEM_ROLE_KEYS } from "#core/authz/system-roles";
import type { RoleRow } from "#core/authz/types";
import { BusinessRuleError, ConflictError, NotFoundError } from "@tatara/http";

export interface RoleInput {
	key: string;
	name: string;
	description?: string | null;
	grants: { resource: string; action: string; scope?: string | null }[];
}

export function listRoles(orgId: string): Promise<RoleRow[]> {
	return store.listRoles(orgId);
}

async function customRole(orgId: string, roleId: string): Promise<RoleRow> {
	const role = await store.findRole(orgId, roleId);
	if (!role) throw new NotFoundError("Role");
	if (role.isSystem) throw new BusinessRuleError("SYSTEM_ROLE_IMMUTABLE", "Built-in roles cannot be changed");
	return role;
}

export async function createRole(actorId: string, orgId: string, input: RoleInput): Promise<RoleRow> {
	if (SYSTEM_ROLE_KEYS.has(input.key)) {
		throw new ConflictError(`"${input.key}" is a built-in role key`);
	}
	if (await store.findRoleByKey(orgId, input.key)) throw new ConflictError(`Role "${input.key}" exists`);
	const grants = validateGrants(input.grants, { allowMeta: false });
	const id = await store.createRole({
		orgId,
		key: input.key,
		name: input.name,
		description: input.description ?? null,
		isSystem: false,
		grants,
	});
	const role = await store.findRole(orgId, id);
	if (!role) throw new NotFoundError("Role");
	await audit({ orgId, actorId, changeType: "role_created", after: role });
	return role;
}

export async function updateRole(
	actorId: string,
	orgId: string,
	roleId: string,
	input: Partial<Omit<RoleInput, "key">>,
): Promise<RoleRow> {
	const before = await customRole(orgId, roleId);
	await store.updateRole(roleId, {
		...(input.name === undefined ? {} : { name: input.name }),
		...(input.description === undefined ? {} : { description: input.description }),
		...(input.grants ? { grants: validateGrants(input.grants, { allowMeta: false }) } : {}),
	});
	invalidateAll();
	const after = await customRole(orgId, roleId);
	await audit({ orgId, actorId, changeType: "role_updated", before, after });
	return after;
}

export async function deleteRole(actorId: string, orgId: string, roleId: string): Promise<void> {
	const role = await customRole(orgId, roleId);
	if (role.memberCount > 0) {
		throw new ConflictError(`Role "${role.key}" is assigned to ${role.memberCount} member(s)`);
	}
	await store.deleteRole(roleId);
	invalidateAll();
	await audit({ orgId, actorId, changeType: "role_deleted", before: role });
}
