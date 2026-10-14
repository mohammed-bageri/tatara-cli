import type { AuditChangeType } from "#core/authz/constants";
import { store } from "#core/authz/db/store";

export async function audit(input: {
	orgId: string;
	actorId: string;
	targetUserId?: string | null;
	changeType: AuditChangeType;
	before?: unknown;
	after?: unknown;
}): Promise<void> {
	await store.writeAudit({
		orgId: input.orgId,
		actorId: input.actorId,
		targetUserId: input.targetUserId ?? null,
		changeType: input.changeType,
		before: input.before,
		after: input.after,
	});
}

export function listAudit(orgId: string, limit = 50) {
	return store.listAudit(orgId, limit);
}
