import { createAuthInstance } from "@tatara/auth";
import { newId } from "@tatara/db";
import { bearer, openAPI } from "better-auth/plugins";
import { env } from "#core/config/env";
import { staffDatabase } from "#modules/staff/services/adapter";
// tatara:slot imports

/** Every staff principal acts in this org, so platform permissions never mix with a customer org's. */
export const PLATFORM_ORG_ID = "platform";

/**
 * A separate better-auth for internal staff, mounted on the admin app only. Staff and users never
 * share a table, a session or a cookie. There's no sign-up: staff accounts come from the seed or
 * a command.
 */
export const { auth: staffAuth, attachPrincipal: attachStaffPrincipal } = createAuthInstance(
	{
		appName: "__APP_NAME__ staff",
		baseURL: env.ADMIN_URL,
		basePath: "/api/auth",
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: env.CORS_ORIGINS,
		database: staffDatabase,
		user: {
			modelName: "staffUser",
			additionalFields: { role: { type: "string", defaultValue: "staff", input: false } },
		},
		session: { modelName: "staffSession" },
		account: { modelName: "staffAccount" },
		verification: { modelName: "staffVerification" },
		advanced: { database: { generateId: () => newId() }, cookiePrefix: "staff" },
		emailAndPassword: { enabled: true, minPasswordLength: 10, disableSignUp: true },
		plugins: [
			// Authorization: Bearer <session token> for API clients
			bearer(),
			// reference for the staff auth endpoints at /api/auth/reference on the admin app
			openAPI(),
		],
	},
	{
		org: PLATFORM_ORG_ID,
		resolvers: [
			// tatara:slot resolvers
		],
	},
);
