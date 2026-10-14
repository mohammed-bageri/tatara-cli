import { betterAuth } from "better-auth";
import { bearer, openAPI } from "better-auth/plugins";
import { database } from "#core/auth/adapter";
import { env } from "#core/config/env";
import { newId } from "#core/db/id";
// tatara:slot imports

export const auth = betterAuth({
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
});

export type Session = typeof auth.$Infer.Session;
