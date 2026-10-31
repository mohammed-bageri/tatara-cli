import { defineSeed } from "@tatara/db";
import { env } from "#core/config/env";
import { staffAuth } from "#modules/staff/services/auth";

/** Development staff account for the admin app (never created in production). */
export default defineSeed({
	name: "staff:dev-admin",
	order: 0,
	async run({ logger }) {
		if (env.NODE_ENV !== "development" && env.NODE_ENV !== "test") return;
		if (!env.SEED_STAFF_PASSWORD) return;
		const ctx = await staffAuth.$context;
		const email = env.SEED_STAFF_EMAIL;
		if (await ctx.internalAdapter.findUserByEmail(email)) return;
		const user = await ctx.internalAdapter.createUser(
			{ email, name: "Dev staff", emailVerified: true, role: "staff" },
			{ method: "admin" },
		);
		await ctx.internalAdapter.linkAccount({
			userId: user.id,
			providerId: "credential",
			accountId: user.id,
			password: await ctx.password.hash(env.SEED_STAFF_PASSWORD),
		});
		logger.info({ email, userId: user.id }, "created development staff account");
	},
});
