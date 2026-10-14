import { env } from "#core/config/env";
import { truncateAllTables } from "#core/db/admin";

/** Empties every application table in this worker's test database. Use in beforeEach. */
export async function resetDatabase(): Promise<void> {
	await truncateAllTables(env.DATABASE_URL);
}
