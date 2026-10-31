import { createRemoteJWKSet, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from "jose";

export interface KeycloakClaims extends JWTPayload {
	sub: string;
	email?: string;
	email_verified?: boolean;
	name?: string;
	preferred_username?: string;
	azp?: string;
	roles?: string[];
	realm_access?: { roles?: string[] };
	resource_access?: Record<string, { roles?: string[] }>;
	organization?: string[] | Record<string, unknown>;
}

export interface KeycloakVerifier {
	readonly issuer: string;
	readonly audience: string;
	/** Verifies signature, issuer, audience and expiry. Throws when the token is not valid. */
	verify(token: string): Promise<KeycloakClaims>;
	/** Replaces the realm's key set; tests use a local one. */
	useKeys(source: JWTVerifyGetKey): void;
}

export interface KeycloakVerifierOptions {
	/** e.g. http://localhost:8080 */
	url: string;
	realm: string;
	/** tokens must carry this audience */
	audience: string;
}

export function keycloakVerifier(options: KeycloakVerifierOptions): KeycloakVerifier {
	const issuer = `${options.url.replace(/\/$/, "")}/realms/${options.realm}`;
	let keys: JWTVerifyGetKey | undefined;
	return {
		issuer,
		audience: options.audience,
		async verify(token) {
			// created on first use, so building the verifier does no work
			keys ??= createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));
			const { payload } = await jwtVerify(token, keys, { issuer, audience: options.audience });
			if (typeof payload.sub !== "string") throw new Error("token has no subject");
			return payload as KeycloakClaims;
		},
		useKeys(source) {
			keys = source;
		},
	};
}

/** Realm roles, the `roles` claim, and the client roles for `audience`. */
export function rolesOf(claims: KeycloakClaims, audience: string): string[] {
	const roles = new Set<string>([
		...(claims.roles ?? []),
		...(claims.realm_access?.roles ?? []),
		...(claims.resource_access?.[audience]?.roles ?? []),
	]);
	return [...roles];
}

/** Every org in the `organization` claim (ids where Keycloak includes them, else aliases). */
export function organizationsOf(claims: KeycloakClaims): string[] {
	const org = claims.organization;
	if (Array.isArray(org)) return org.filter((o): o is string => typeof o === "string");
	if (org && typeof org === "object")
		return Object.entries(org).map(([alias, value]) => {
			const id = (value as { id?: unknown } | undefined)?.id;
			return typeof id === "string" ? id : alias;
		});
	return [];
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
