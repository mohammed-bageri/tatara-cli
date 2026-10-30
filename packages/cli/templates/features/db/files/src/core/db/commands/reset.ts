import { z } from "zod";
import { defineCommand, flag } from "@tatara/core";
import { env } from "#core/config/env";
import { dropAllTables } from "#core/db/admin";
import { migrateDatabase } from "#core/db/migrate";

export default defineCommand({
	name: "db:reset",
	description: "Drop every table and re-apply migrations (refuses to run in production)",
	args: z.object({ force: flag() }),
	async run({ force }, { logger }) {
		if (env.NODE_ENV === "production" && !force) {
			throw new Error("db:reset refuses to run with NODE_ENV=production (pass --force to override)");
		}
		await dropAllTables(env.DATABASE_URL);
		await migrateDatabase(env.DATABASE_URL);
		logger.info("database reset");
	},
});
