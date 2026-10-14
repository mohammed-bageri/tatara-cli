import { generateKeyPair, SignJWT } from "jose";
import { issuer, setKeySource } from "#core/auth/keycloak";
import { env } from "#core/config/env";
import { newId } from "#core/db/id";
// tatara:slot imports

const { publicKey, privateKey } = await generateKeyPair("RS256");
setKeySource(async (header) => {
	if (header.kid !== "test") throw new Error("unknown key");
	return publicKey;
});

export interface AsUserOptions {
	sub?: string;
	email?: string;
	roles?: string[];
	orgId?: string;
	// tatara:slot options
}

/** Signs a token the API accepts, as if Keycloak issued it for a new user. */
export async function tokenFor(options: AsUserOptions = {}): Promise<string> {
	const sub = options.sub ?? newId();
	return new SignJWT({
		email: options.email ?? `user-${sub}@example.com`,
		preferred_username: `user-${sub.slice(0, 8)}`,
		roles: options.roles ?? ["user"],
		...(options.orgId ? { organization: [options.orgId] } : {}),
	})
		.setProtectedHeader({ alg: "RS256", kid: "test" })
		.setSubject(sub)
		.setIssuer(issuer)
		.setAudience(env.KEYCLOAK_AUDIENCE)
		.setIssuedAt()
		.setExpirationTime("5m")
		.sign(privateKey);
}

/** Headers that authenticate as a new user. */
export async function asUser(options: AsUserOptions = {}): Promise<Record<string, string>> {
	// tatara:slot as-user
	return { authorization: `Bearer ${await tokenFor(options)}` };
}
