import { createAuthInstance } from "@tatara/auth";
import { newId } from "@tatara/db";
import { bearer, openAPI } from "better-auth/plugins";
import { env } from "#core/config/env";
import { database } from "#modules/users/services/adapter";
// tatara:slot imports

/**
 * The app's better-auth for its users. The options are the app's own; tatara only adds the
 * principal middleware and the org check that come back with the instance.
 */
export const { auth, attachPrincipal, requireOrg } = createAuthInstance(
	{
		appName: "__APP_NAME__",
		baseURL: env.APP_URL,
		basePath: "/api/auth",
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: env.CORS_ORIGINS,
		database,
		advanced: { database: { generateId: () => newId() } },
		// tatara:slot options
		plugins: [
			// Authorization: Bearer <session token> for mobile and API clients
			bearer(),
			// reference for the auth endpoints at /api/auth/reference
			openAPI(),
			// tatara:slot plugins
		],
	},
	{
		resolvers: [
			// tatara:slot resolvers
		],
	},
);

export type Session = typeof auth.$Infer.Session;
