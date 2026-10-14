import { getCached, setCached } from "#core/authz/cache";
import { DEFAULT_ORG_ID, SCOPE_RANK, type Scope } from "#core/authz/constants";
import { store } from "#core/authz/db/store";
import { SYSTEM_ROLE_KEYS } from "#core/authz/system-roles";
import { type EffectivePermissions, grantKey, type PermissionGrant } from "#core/authz/types";
import type { Principal } from "#core/http/context";

/** The org a principal acts in: its active org, or the default org. */
export function orgOf(principal: Pick<Principal, "orgId">): string {
	return principal.orgId ?? DEFAULT_ORG_ID;
}

/** Roles from the identity provider that match a built-in role key are honoured as that role. */
function impliedRoles(principal: Pick<Principal, "roles">): string[] {
	return principal.roles.filter((role) => SYSTEM_ROLE_KEYS.has(role));
}

/**
 * Effective permissions = grants of the member's roles (assigned in the org, plus built-in
 * roles implied by the identity provider) + active grant overlays − active deny overlays.
 */
export async function effectivePermissions(
	principal: Pick<Principal, "userId" | "orgId" | "roles">,
): Promise<EffectivePermissions> {
	const orgId = orgOf(principal);
	const implied = impliedRoles(principal);
	const cached = getCached(orgId, principal.userId, implied);
	if (cached) return cached;

	const [{ roles, grants }, overlays] = await Promise.all([
		store.roleGrants(orgId, principal.userId, implied),
		store.activeOverlays(orgId, principal.userId, new Date()),
	]);
	const all: PermissionGrant[] = [...grants];
	const denies = new Set<string>();
	for (const overlay of overlays) {
		const grant = { resource: overlay.resource, action: overlay.action, scope: overlay.scope };
		if (overlay.effect === "deny") denies.add(grantKey(grant));
		else all.push(grant);
	}
	const value = { grants: all, denies, roles };
	setCached(orgId, principal.userId, implied, value);
	return value;
}

/** Pure check against a resolved set: deny wins; scoped checks honour org > team > own. */
export function allows(
	permissions: EffectivePermissions,
	resource: string,
	action: string,
	scope?: Scope,
): boolean {
	if (permissions.denies.has(`${resource}:${action}:${scope ?? "*"}`)) return false;
	if (scope && permissions.denies.has(`${resource}:${action}:*`)) return false;
	// a denied grant can never satisfy a check, even a narrower one
	const live = permissions.grants.filter(
		(g) => !permissions.denies.has(grantKey(g)) && !permissions.denies.has(`${g.resource}:${g.action}:*`),
	);
	if (!scope) {
		return live.some((g) => g.resource === resource && g.action === action);
	}
	const required = SCOPE_RANK[scope];
	return live.some(
		(g) =>
			g.resource === resource &&
			g.action === action &&
			g.scope !== null &&
			SCOPE_RANK[g.scope] >= required,
	);
}

export async function checkPermission(
	principal: Pick<Principal, "userId" | "orgId" | "roles">,
	permission: string,
	scope?: Scope,
): Promise<boolean> {
	const [resource = "", action = ""] = permission.split(":");
	return allows(await effectivePermissions(principal), resource, action, scope);
}

/**
 * The widest scope the principal holds for a scoped action. Middleware proves the caller
 * may act at some scope; services use this to decide which rows to return.
 */
export async function resolveScope(
	principal: Pick<Principal, "userId" | "orgId" | "roles">,
	permission: string,
): Promise<Scope | null> {
	const [resource = "", action = ""] = permission.split(":");
	const permissions = await effectivePermissions(principal);
	let best: Scope | null = null;
	for (const g of permissions.grants) {
		if (g.resource !== resource || g.action !== action || g.scope === null) continue;
		if (permissions.denies.has(grantKey(g))) continue;
		if (!best || SCOPE_RANK[g.scope] > SCOPE_RANK[best]) best = g.scope;
	}
	return best;
}
