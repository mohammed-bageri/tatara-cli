import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { ensureDatabase } from "#core/db/admin";
import { migrateDatabase } from "#core/db/migrate";
import { TEST_WORKERS, workerDatabaseUrl } from "#tests/helpers/database-url";

/** Creates and migrates one database per test worker, once per run. */
export default async function setup() {
	const fileEnv = existsSync(".env.test")
		? (parseEnv(readFileSync(".env.test", "utf8")) as Record<string, string>)
		: {};
	const base = process.env.DATABASE_URL ?? fileEnv.DATABASE_URL;
	if (!base) throw new Error("DATABASE_URL is not set for tests (.env.test)");
	try {
		await Promise.all(
			Array.from({ length: TEST_WORKERS }, async (_, i) => {
				const url = workerDatabaseUrl(base, i + 1);
				await ensureDatabase(url);
				await migrateDatabase(url);
			}),
		);
	} catch (error) {
		throw new Error(
			`Could not prepare the test databases. Is the database running? (\`docker compose up -d --wait\`)\n${String(error)}`,
		);
	}
}
