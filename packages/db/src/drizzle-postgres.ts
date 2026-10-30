import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

/** Applies ./drizzle migrations to the database at `url`. */
export async function migrateDatabase(url: string): Promise<void> {
	const pool = new pg.Pool({ connectionString: url, max: 1 });
	try {
		await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
	} finally {
		await pool.end();
	}
}
