import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

/** Applies ./drizzle migrations to the database at `url`. */
export async function migrateDatabase(url: string): Promise<void> {
	const connection = await mysql.createConnection({ uri: url });
	try {
		await migrate(drizzle({ client: connection }), { migrationsFolder: "drizzle" });
	} finally {
		await connection.end();
	}
}
