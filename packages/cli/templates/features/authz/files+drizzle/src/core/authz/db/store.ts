import { and, count, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import type { OverlayEffect, Scope } from "#core/authz/constants";
import { SYSTEM_ORG_ID } from "#core/authz/constants";
import {
	authzAuditLog,
	authzMemberRoles,
	authzOverlays,
	authzRolePermissions,
	authzRoles,
} from "#core/authz/db/authz.schema";
import type { AuthzStore, OverlayRow, PermissionGrant, RoleRow } from "#core/authz/types";
import { db } from "#core/db/client";
import { newId } from "#core/db/id";

const toScope = (scope: string): Scope | null => (scope === "" ? null : (scope as Scope));

type RoleRecord = typeof authzRoles.$inferSelect;
type OverlayRecord = typeof authzOverlays.$inferSelect;

function toOverlay(row: OverlayRecord): OverlayRow {
	return { ...row, scope: toScope(row.scope), effect: row.effect as OverlayEffect };
}

async function hydrate(roles: RoleRecord[], orgId: string): Promise<RoleRow[]> {
	if (roles.length === 0) return [];
	const ids = roles.map((r) => r.id);
	const [grants, members] = await Promise.all([
		db.select().from(authzRolePermissions).where(inArray(authzRolePermissions.roleId, ids)),
		db
			.select({ roleId: authzMemberRoles.roleId, total: count() })
			.from(authzMemberRoles)
			.where(and(eq(authzMemberRoles.orgId, orgId), inArray(authzMemberRoles.roleId, ids)))
			.groupBy(authzMemberRoles.roleId),
	]);
	return roles.map((role) => ({
		id: role.id,
		orgId: role.orgId,
		key: role.key,
		name: role.name,
		description: role.description,
		isSystem: role.isSystem,
		grants: grants
			.filter((g) => g.roleId === role.id)
			.map((g) => ({ resource: g.resource, action: g.action, scope: toScope(g.scope) })),
		memberCount: members.find((m) => m.roleId === role.id)?.total ?? 0,
	}));
}

const visibleTo = (orgId: string) => or(eq(authzRoles.orgId, SYSTEM_ORG_ID), eq(authzRoles.orgId, orgId));

async function insertGrants(roleId: string, grants: PermissionGrant[]) {
	if (grants.length === 0) return;
	await db.insert(authzRolePermissions).values(
		grants.map((g) => ({
			id: newId(),
			roleId,
			resource: g.resource,
			action: g.action,
			scope: g.scope ?? "",
		})),
	);
}

export const store: AuthzStore = {
	async roleGrants(orgId, userId, impliedRoleKeys) {
		const assigned = await db
			.select({ roleId: authzMemberRoles.roleId })
			.from(authzMemberRoles)
			.where(and(eq(authzMemberRoles.orgId, orgId), eq(authzMemberRoles.userId, userId)));
		const implied = impliedRoleKeys.length
			? await db
					.select({ id: authzRoles.id })
					.from(authzRoles)
					.where(and(eq(authzRoles.orgId, SYSTEM_ORG_ID), inArray(authzRoles.key, impliedRoleKeys)))
			: [];
		const roleIds = [...new Set([...assigned.map((r) => r.roleId), ...implied.map((r) => r.id)])];
		if (roleIds.length === 0) return { roles: [], grants: [] };
		const [roles, grants] = await Promise.all([
			db.select({ key: authzRoles.key }).from(authzRoles).where(inArray(authzRoles.id, roleIds)),
			db.select().from(authzRolePermissions).where(inArray(authzRolePermissions.roleId, roleIds)),
		]);
		return {
			roles: roles.map((r) => r.key),
			grants: grants.map((g) => ({ resource: g.resource, action: g.action, scope: toScope(g.scope) })),
		};
	},

	async activeOverlays(orgId, userId, now) {
		const rows = await db
			.select()
			.from(authzOverlays)
			.where(
				and(
					eq(authzOverlays.orgId, orgId),
					eq(authzOverlays.userId, userId),
					or(isNull(authzOverlays.expiresAt), gt(authzOverlays.expiresAt, now)),
				),
			);
		return rows.map(toOverlay);
	},

	async listRoles(orgId) {
		const roles = await db.select().from(authzRoles).where(visibleTo(orgId)).orderBy(authzRoles.key);
		return hydrate(roles, orgId);
	},

	async findRole(orgId, roleId) {
		const roles = await db
			.select()
			.from(authzRoles)
			.where(and(eq(authzRoles.id, roleId), visibleTo(orgId)));
		return (await hydrate(roles, orgId))[0] ?? null;
	},

	async findRoleByKey(orgId, key) {
		const roles = await db
			.select()
			.from(authzRoles)
			.where(and(eq(authzRoles.key, key), eq(authzRoles.orgId, orgId)));
		return (await hydrate(roles, orgId))[0] ?? null;
	},

	async createRole(input) {
		const id = newId();
		await db.insert(authzRoles).values({
			id,
			orgId: input.orgId,
			key: input.key,
			name: input.name,
			description: input.description,
			isSystem: input.isSystem,
		});
		await insertGrants(id, input.grants);
		return id;
	},

	async updateRole(roleId, input) {
		const fields = {
			...(input.name === undefined ? {} : { name: input.name }),
			...(input.description === undefined ? {} : { description: input.description }),
		};
		await db
			.update(authzRoles)
			.set({ ...fields, updatedAt: new Date() })
			.where(eq(authzRoles.id, roleId));
		if (input.grants) {
			await db.delete(authzRolePermissions).where(eq(authzRolePermissions.roleId, roleId));
			await insertGrants(roleId, input.grants);
		}
	},

	async deleteRole(roleId) {
		await db.delete(authzRoles).where(eq(authzRoles.id, roleId));
	},

	async memberRoles(orgId, userId) {
		const assigned = await db
			.select({ roleId: authzMemberRoles.roleId })
			.from(authzMemberRoles)
			.where(and(eq(authzMemberRoles.orgId, orgId), eq(authzMemberRoles.userId, userId)));
		if (assigned.length === 0) return [];
		const roles = await db
			.select()
			.from(authzRoles)
			.where(inArray(authzRoles.id, assigned.map((a) => a.roleId)));
		return hydrate(roles, orgId);
	},

	async assignRole(orgId, userId, roleId, by) {
		const existing = await db
			.select({ id: authzMemberRoles.id })
			.from(authzMemberRoles)
			.where(
				and(
					eq(authzMemberRoles.orgId, orgId),
					eq(authzMemberRoles.userId, userId),
					eq(authzMemberRoles.roleId, roleId),
				),
			);
		if (existing.length > 0) return false;
		await db.insert(authzMemberRoles).values({ id: newId(), orgId, userId, roleId, assignedBy: by });
		return true;
	},

	async revokeRole(orgId, userId, roleId) {
		const where = and(
			eq(authzMemberRoles.orgId, orgId),
			eq(authzMemberRoles.userId, userId),
			eq(authzMemberRoles.roleId, roleId),
		);
		const existing = await db.select({ id: authzMemberRoles.id }).from(authzMemberRoles).where(where);
		if (existing.length === 0) return false;
		await db.delete(authzMemberRoles).where(where);
		return true;
	},

	async removeMember(orgId, userId) {
		const roleWhere = and(eq(authzMemberRoles.orgId, orgId), eq(authzMemberRoles.userId, userId));
		const overlayWhere = and(eq(authzOverlays.orgId, orgId), eq(authzOverlays.userId, userId));
		// count first: MySQL has no RETURNING
		return db.transaction(async (tx) => {
			const [roles] = await tx.select({ n: count() }).from(authzMemberRoles).where(roleWhere);
			const [overlays] = await tx.select({ n: count() }).from(authzOverlays).where(overlayWhere);
			await tx.delete(authzMemberRoles).where(roleWhere);
			await tx.delete(authzOverlays).where(overlayWhere);
			return { roles: roles?.n ?? 0, overlays: overlays?.n ?? 0 };
		});
	},

	async listOverlays(orgId, userId) {
		const rows = await db
			.select()
			.from(authzOverlays)
			.where(and(eq(authzOverlays.orgId, orgId), eq(authzOverlays.userId, userId)))
			.orderBy(desc(authzOverlays.createdAt));
		return rows.map(toOverlay);
	},

	async addOverlay(input) {
		const id = newId();
		const scope = input.scope ?? "";
		await db
			.delete(authzOverlays)
			.where(
				and(
					eq(authzOverlays.orgId, input.orgId),
					eq(authzOverlays.userId, input.userId),
					eq(authzOverlays.resource, input.resource),
					eq(authzOverlays.action, input.action),
					eq(authzOverlays.scope, scope),
					eq(authzOverlays.effect, input.effect),
				),
			);
		await db.insert(authzOverlays).values({ ...input, id, scope });
		return id;
	},

	async removeOverlay(orgId, userId, overlayId) {
		const where = and(
			eq(authzOverlays.orgId, orgId),
			eq(authzOverlays.userId, userId),
			eq(authzOverlays.id, overlayId),
		);
		const [row] = await db.select().from(authzOverlays).where(where);
		if (!row) return null;
		await db.delete(authzOverlays).where(where);
		return toOverlay(row);
	},

	async writeAudit(input) {
		await db.insert(authzAuditLog).values({
			id: newId(),
			orgId: input.orgId,
			actorId: input.actorId,
			targetUserId: input.targetUserId,
			changeType: input.changeType,
			before: input.before === undefined ? null : JSON.stringify(input.before),
			after: input.after === undefined ? null : JSON.stringify(input.after),
		});
	},

	async listAudit(orgId, limit) {
		const rows = await db
			.select()
			.from(authzAuditLog)
			.where(eq(authzAuditLog.orgId, orgId))
			.orderBy(desc(authzAuditLog.id))
			.limit(limit);
		return rows.map((r) => ({
			...r,
			before: r.before ? (JSON.parse(r.before) as unknown) : null,
			after: r.after ? (JSON.parse(r.after) as unknown) : null,
		}));
	},
};
