/** @tatara/keycloak: accept Keycloak access tokens in a better-auth app. */
export {
	type KeycloakAuth,
	type KeycloakTokensOptions,
	keycloakPrincipal,
	keycloakTokens,
} from "./plugin.ts";
export {
	type KeycloakClaims,
	type KeycloakVerifier,
	type KeycloakVerifierOptions,
	keycloakVerifier,
	organizationOf,
	organizationsOf,
	rolesOf,
} from "./verifier.ts";
