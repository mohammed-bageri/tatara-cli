import { keycloakVerifier } from "@tatara/keycloak";
import { env } from "#core/config/env";

/** Verifies access tokens from the realm; `keycloakTokens()` in auth.ts uses it. */
export const keycloak = keycloakVerifier({
	url: env.KEYCLOAK_URL,
	realm: env.KEYCLOAK_REALM,
	audience: env.KEYCLOAK_AUDIENCE,
});
