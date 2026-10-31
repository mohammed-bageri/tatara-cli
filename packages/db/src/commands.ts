import { type CommandDefinition, defineCommand, flag } from "@tatara/core";
import { z } from "zod";
import type { SeedDefinition } from "./seed.ts";

export interface DbCommandsOptions {
	env: { DATABASE_URL: string; NODE_ENV: string };
	/** the app's driver re-exports (src/core/db/migrate.ts, admin.ts) */
	migrateDatabase(url: string): Promise<void>;
	dropAllTables(url: string): Promise<void>;
	/** every seed `tatara sync` found */
	seeds: SeedDefinition[];
}

/** db:migrate, db:reset and db:seed; wired into the app by `tatara sync`. */
export function dbCommands(options: DbCommandsOptions): CommandDefinition[] {
	const { env, migrateDatabase, dropAllTables, seeds } = options;
	return [
		defineCommand({
			name: "db:migrate",
			description: "Apply pending database migrations",
			async run(_args, { logger }) {
				await migrateDatabase(env.DATABASE_URL);
				logger.info("migrations applied");
			},
		}),
		defineCommand({
			name: "db:reset",
			description: "Drop every table and re-apply migrations (refuses to run in production)",
			args: z.object({ force: flag() }),
			async run({ force }, { logger }) {
				if (env.NODE_ENV === "production" && !force) {
					throw new Error(
						"db:reset refuses to run with NODE_ENV=production (pass --force to override)",
					);
				}
				await dropAllTables(env.DATABASE_URL);
				await migrateDatabase(env.DATABASE_URL);
				logger.info("database reset");
			},
		}),
		defineCommand({
			name: "db:seed",
			description: "Run every idempotent seed (core first, then modules)",
			async run(_args, { logger }) {
				for (const seed of [...seeds].sort((a, b) => (a.order ?? 100) - (b.order ?? 100))) {
					await seed.run({ logger: logger.child({ seed: seed.name }) });
					logger.info({ seed: seed.name }, "seeded");
				}
			},
		}),
	] as CommandDefinition[];
}
