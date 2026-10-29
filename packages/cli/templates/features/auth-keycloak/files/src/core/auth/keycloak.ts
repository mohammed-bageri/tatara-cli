import { createRemoteJWKSet, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from "jose";
import { env } from "#core/config/env";

export const issuer = `${env.KEYCLOAK_URL.replace(/\/$/, "")}/realms/${env.KEYCLOAK_REALM}`;

let keySource: JWTVerifyGetKey = createRemoteJWKSet(
	new URL(`${issuer}/protocol/openid-connect/certs`),
);

/** Tests replace the realm's key set with a local one. */
export function setKeySource(source: JWTVerifyGetKey): void {
	keySource = source;
}

export interface KeycloakClaims extends JWTPayload {
	sub: string;
	email?: string;
	name?: string;
	preferred_username?: string;
	azp?: string;
	roles?: string[];
	realm_access?: { roles?: string[] };
	resource_access?: Record<string, { roles?: string[] }>;
	organization?: string[] | Record<string, unknown>;
}

/** Verifies signature, issuer, audience and expiry. Throws when the token is not valid. */
export async function verifyAccessToken(token: string): Promise<KeycloakClaims> {
	const { payload } = await jwtVerify(token, keySource, {
		issuer,
		audience: env.KEYCLOAK_AUDIENCE,
	});
	if (typeof payload.sub !== "string") throw new Error("token has no subject");
	return payload as KeycloakClaims;
}

export function rolesOf(claims: KeycloakClaims): string[] {
	const roles = new Set<string>([
		...(claims.roles ?? []),
		...(claims.realm_access?.roles ?? []),
		...(claims.resource_access?.[env.KEYCLOAK_AUDIENCE]?.roles ?? []),
	]);
	return [...roles];
}

/** Keycloak organizations put memberships in the `organization` claim; the first one wins. */
export function organizationOf(claims: KeycloakClaims): string | null {
	const org = claims.organization;
	if (Array.isArray(org)) return org[0] ?? null;
	if (org && typeof org === "object") {
		const [first] = Object.entries(org);
		if (!first) return null;
		const [alias, value] = first;
		const id = (value as { id?: unknown } | undefined)?.id;
		return typeof id === "string" ? id : alias;
	}
	return null;
}
