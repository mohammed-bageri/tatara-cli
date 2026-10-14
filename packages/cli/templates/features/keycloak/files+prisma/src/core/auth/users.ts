import type { KeycloakClaims } from "#core/auth/keycloak";
import { db } from "#core/db/client";

const known = new Set<string>();

/** Creates the local user row for a token subject the first time it is seen. */
export async function ensureLocalUser(claims: KeycloakClaims): Promise<void> {
	if (known.has(claims.sub)) return;
	const data = { email: claims.email ?? null, name: claims.name ?? claims.preferred_username ?? null };
	await db.user.upsert({ where: { id: claims.sub }, create: { id: claims.sub, ...data }, update: data });
	if (known.size > 10_000) known.clear();
	known.add(claims.sub);
}
