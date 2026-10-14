import type { KeycloakClaims } from "#core/auth/keycloak";
import { users } from "#core/auth/db/user.schema";
import { db } from "#core/db/client";

const known = new Set<string>();

/** Creates the local user row for a token subject the first time it is seen. */
export async function ensureLocalUser(claims: KeycloakClaims): Promise<void> {
	if (known.has(claims.sub)) return;
	const values = {
		id: claims.sub,
		email: claims.email ?? null,
		name: claims.name ?? claims.preferred_username ?? null,
	};
	// tatara:slot upsert
	if (known.size > 10_000) known.clear();
	known.add(claims.sub);
}
