/** Test helpers: tokens signed with a local key, as if Keycloak issued them. */
import { generateKeyPair, SignJWT } from "jose";
import type { KeycloakVerifier } from "./verifier.ts";

export interface KeycloakTokenOptions {
	sub?: string;
	email?: string;
	emailVerified?: boolean;
	roles?: string[];
	organization?: string[] | Record<string, unknown>;
	username?: string;
	issuer?: string;
	audience?: string;
	expiresIn?: string | number;
}

export type KeycloakTokenSigner = (options?: KeycloakTokenOptions) => Promise<string>;

/** Points the verifier at a fresh local key and returns a signer for tokens it accepts. */
export async function useTestKeys(verifier: KeycloakVerifier): Promise<KeycloakTokenSigner> {
	const { publicKey, privateKey } = await generateKeyPair("RS256");
	verifier.useKeys(async (header) => {
		if (header.kid !== "test") throw new Error("unknown key");
		return publicKey;
	});
	return async (options = {}) => {
		const sub = options.sub ?? crypto.randomUUID();
		return new SignJWT({
			email: options.email ?? `user-${sub}@example.com`,
			email_verified: options.emailVerified ?? true,
			preferred_username: options.username ?? `user-${sub.slice(0, 8)}`,
			roles: options.roles ?? ["user"],
			...(options.organization ? { organization: options.organization } : {}),
		})
			.setProtectedHeader({ alg: "RS256", kid: "test" })
			.setSubject(sub)
			.setIssuer(options.issuer ?? verifier.issuer)
			.setAudience(options.audience ?? verifier.audience)
			.setIssuedAt()
			.setExpirationTime(options.expiresIn ?? "5m")
			.sign(privateKey);
	};
}
