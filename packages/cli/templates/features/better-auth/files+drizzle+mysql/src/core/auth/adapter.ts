import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as authSchema from "#core/auth/db/auth.schema";
import { db } from "#core/db/client";
// tatara:slot imports

export const database = drizzleAdapter(db, {
	provider: "mysql",
	schema: {
		user: authSchema.users,
		session: authSchema.sessions,
		account: authSchema.accounts,
		verification: authSchema.verifications,
		// tatara:slot adapter-schema
	},
});
