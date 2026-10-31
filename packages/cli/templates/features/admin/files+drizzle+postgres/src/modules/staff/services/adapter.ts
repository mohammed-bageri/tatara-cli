import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "#core/db/client";
import * as staff from "#modules/staff/db/staff.schema";

export const staffDatabase = drizzleAdapter(db, {
	provider: "pg",
	schema: {
		staffUser: staff.staffUsers,
		staffSession: staff.staffSessions,
		staffAccount: staff.staffAccounts,
		staffVerification: staff.staffVerifications,
	},
});
