import { invalidateMember } from "#core/authz/cache";
import type { OverlayEffect, Scope } from "#core/authz/constants";
import { store } from "#core/authz/db/store";
import { audit } from "#core/authz/services/audit";
import { validateGrants } from "#core/authz/services/grants";
import { NotFoundError } from "#core/http/errors";

export async function getMember(orgId: string, userId: string) {
	const [roles, overlays] = await Promise.all([
		store.memberRoles(orgId, userId),
		store.listOverlays(orgId, userId),
	]);
	return { userId, orgId, roles, overlays };
}

export async function assignRole(actorId: string | null, orgId: string, userId: string, roleId: string) {
	const role = await store.findRole(orgId, roleId);
	if (!role) throw new NotFoundError("Role");
	const added = await store.assignRole(orgId, userId, roleId, actorId);
	invalidateMember(userId, orgId);
	if (added && actorId) {
		await audit({ orgId, actorId, targetUserId: userId, changeType: "member_role_assigned", after: { roleId, key: role.key } });
	}
	return added;
}

export async function revokeRole(actorId: string, orgId: string, userId: string, roleId: string) {
	const removed = await store.revokeRole(orgId, userId, roleId);
	if (!removed) throw new NotFoundError("Role assignment");
	invalidateMember(userId, orgId);
	await audit({ orgId, actorId, targetUserId: userId, changeType: "member_role_revoked", before: { roleId } });
}

export interface OverlayInput {
	resource: string;
	action: string;
	scope?: Scope | null;
	effect: OverlayEffect;
	reason?: string | null;
	expiresAt?: Date | null;
}

/** Per-user grant or deny, optionally expiring. Deny always wins over any grant. */
export async function addOverlay(actorId: string | null, orgId: string, userId: string, input: OverlayInput) {
	const [grant] = validateGrants([input], { allowMeta: input.effect === "deny" });
	if (!grant) throw new NotFoundError("Permission");
	const id = await store.addOverlay({
		orgId,
		userId,
		...grant,
		effect: input.effect,
		grantedBy: actorId,
		reason: input.reason ?? null,
		expiresAt: input.expiresAt ?? null,
	});
	invalidateMember(userId, orgId);
	if (actorId) {
		await audit({ orgId, actorId, targetUserId: userId, changeType: "overlay_granted", after: { id, ...grant, effect: input.effect } });
	}
	return id;
}

export async function removeOverlay(actorId: string, orgId: string, userId: string, overlayId: string) {
	const removed = await store.removeOverlay(orgId, userId, overlayId);
	if (!removed) throw new NotFoundError("Overlay");
	invalidateMember(userId, orgId);
	await audit({ orgId, actorId, targetUserId: userId, changeType: "overlay_revoked", before: removed });
}
