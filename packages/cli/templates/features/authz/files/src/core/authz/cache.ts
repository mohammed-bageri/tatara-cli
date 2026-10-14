import { CACHE_TTL_MS } from "#core/authz/constants";
import type { EffectivePermissions } from "#core/authz/types";

const entries = new Map<string, { value: EffectivePermissions; expires: number }>();

const key = (orgId: string, userId: string, roles: string[]) =>
	`${orgId}:${userId}:${[...roles].sort().join(",")}`;

export function getCached(orgId: string, userId: string, roles: string[]) {
	const entry = entries.get(key(orgId, userId, roles));
	if (!entry || entry.expires < Date.now()) return undefined;
	return entry.value;
}

export function setCached(orgId: string, userId: string, roles: string[], value: EffectivePermissions) {
	if (entries.size > 10_000) entries.clear();
	entries.set(key(orgId, userId, roles), { value, expires: Date.now() + CACHE_TTL_MS });
}

/** Drops cached sets for one member (any org when orgId is omitted). */
export function invalidateMember(userId: string, orgId?: string) {
	for (const k of entries.keys()) {
		const [o, u] = k.split(":");
		if (u === userId && (!orgId || o === orgId)) entries.delete(k);
	}
}

/** Role definitions changed: every cached set may be stale. */
export function invalidateAll() {
	entries.clear();
}
