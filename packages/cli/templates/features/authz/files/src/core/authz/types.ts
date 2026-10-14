import type { OverlayEffect, Scope } from "#core/authz/constants";

export interface PermissionGrant {
	resource: string;
	action: string;
	scope: Scope | null;
}

export interface OverlayRow extends PermissionGrant {
	id: string;
	orgId: string;
	userId: string;
	effect: OverlayEffect;
	grantedBy: string | null;
	reason: string | null;
	expiresAt: Date | null;
	createdAt: Date;
}

export interface RoleRow {
	id: string;
	orgId: string;
	key: string;
	name: string;
	description: string | null;
	isSystem: boolean;
	grants: PermissionGrant[];
	memberCount: number;
}

export interface AuditRow {
	id: string;
	orgId: string;
	actorId: string;
	targetUserId: string | null;
	changeType: string;
	before: unknown;
	after: unknown;
	at: Date;
}

/** A member's resolved permissions in one org. */
export interface EffectivePermissions {
	grants: PermissionGrant[];
	/** "resource:action:scope|*" keys denied by overlays; deny always wins */
	denies: Set<string>;
	roles: string[];
}

export function grantKey(grant: PermissionGrant): string {
	return `${grant.resource}:${grant.action}:${grant.scope ?? "*"}`;
}

/** Everything authz reads and writes; implemented once per ORM in #core/authz/db/store. */
export interface AuthzStore {
	roleGrants(orgId: string, userId: string, impliedRoleKeys: string[]): Promise<{
		roles: string[];
		grants: PermissionGrant[];
	}>;
	activeOverlays(orgId: string, userId: string, now: Date): Promise<OverlayRow[]>;
	listRoles(orgId: string): Promise<RoleRow[]>;
	findRole(orgId: string, roleId: string): Promise<RoleRow | null>;
	findRoleByKey(orgId: string, key: string): Promise<RoleRow | null>;
	createRole(input: {
		orgId: string;
		key: string;
		name: string;
		description: string | null;
		isSystem: boolean;
		grants: PermissionGrant[];
	}): Promise<string>;
	updateRole(
		roleId: string,
		input: { name?: string; description?: string | null; grants?: PermissionGrant[] },
	): Promise<void>;
	deleteRole(roleId: string): Promise<void>;
	memberRoles(orgId: string, userId: string): Promise<RoleRow[]>;
	assignRole(orgId: string, userId: string, roleId: string, by: string | null): Promise<boolean>;
	revokeRole(orgId: string, userId: string, roleId: string): Promise<boolean>;
	listOverlays(orgId: string, userId: string): Promise<OverlayRow[]>;
	addOverlay(input: Omit<OverlayRow, "id" | "createdAt">): Promise<string>;
	removeOverlay(orgId: string, overlayId: string): Promise<OverlayRow | null>;
	writeAudit(input: Omit<AuditRow, "id" | "at">): Promise<void>;
	listAudit(orgId: string, limit: number): Promise<AuditRow[]>;
}
