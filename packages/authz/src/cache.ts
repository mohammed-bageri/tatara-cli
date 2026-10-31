import type { EffectivePermissions } from "./types.ts";

export interface PermissionCache {
	get(orgId: string, userId: string, roles: string[]): EffectivePermissions | undefined;
	set(orgId: string, userId: string, roles: string[], value: EffectivePermissions): void;
	/** Drops cached sets for one member (any org when orgId is omitted). */
	invalidateMember(userId: string, orgId?: string): void;
	/** Role definitions changed: every cached set may be stale. */
	invalidateAll(): void;
}

/** In-process cache of resolved permission sets. */
export function createPermissionCache(ttlMs: number): PermissionCache {
	const entries = new Map<string, { value: EffectivePermissions; expires: number }>();
	const key = (orgId: string, userId: string, roles: string[]) =>
		`${orgId}:${userId}:${[...roles].sort().join(",")}`;
	return {
		get(orgId, userId, roles) {
			const entry = entries.get(key(orgId, userId, roles));
			if (!entry || entry.expires < Date.now()) return undefined;
			return entry.value;
		},
		set(orgId, userId, roles, value) {
			if (entries.size > 10_000) entries.clear();
			entries.set(key(orgId, userId, roles), { value, expires: Date.now() + ttlMs });
		},
		invalidateMember(userId, orgId) {
			for (const k of entries.keys()) {
				const [o, u] = k.split(":");
				if (u === userId && (!orgId || o === orgId)) entries.delete(k);
			}
		},
		invalidateAll() {
			entries.clear();
		},
	};
}
