import { defineCommand } from "#core/commands/define";
import { env } from "#core/config/env";
import { migrateDatabase } from "#core/db/migrate";

export default defineCommand({
	name: "db:migrate",
	description: "Apply pending database migrations",
	async run(_args, { logger }) {
		await migrateDatabase(env.DATABASE_URL);
		logger.info("migrations applied");
	},
});
