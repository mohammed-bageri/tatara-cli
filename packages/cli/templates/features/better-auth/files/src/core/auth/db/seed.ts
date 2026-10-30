import { auth } from "#core/auth/auth";
import { env } from "#core/config/env";
import { defineSeed } from "@tatara/db";

/** Development admin account (never created in production). */
export default defineSeed({
	name: "auth:dev-admin",
	order: 0,
	async run({ logger }) {
		if (env.NODE_ENV !== "development" && env.NODE_ENV !== "test") return;
		const ctx = await auth.$context;
		const email = env.SEED_ADMIN_EMAIL;
		const existing = await ctx.internalAdapter.findUserByEmail(email);
		if (existing) return;
		const user = await ctx.internalAdapter.createUser({
			email,
			name: "Dev admin",
			emailVerified: true,
			// tatara:slot seed-user-fields
		}, { method: "admin" });
		// tatara:slot seed-after-user
		logger.info({ email, userId: user.id }, "created development admin");
	},
});
