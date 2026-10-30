import pg from "pg";

const MIGRATION_TABLES = ["__drizzle_migrations", "_prisma_migrations"];

function databaseName(url: string): string {
	return decodeURIComponent(new URL(url).pathname.slice(1));
}

async function withClient<T>(url: string, fn: (client: pg.Client) => Promise<T>): Promise<T> {
	const client = new pg.Client({ connectionString: url });
	await client.connect();
	try {
		return await fn(client);
	} finally {
		await client.end();
	}
}

/** Creates the database named in `url` if it does not exist. */
export async function ensureDatabase(url: string): Promise<void> {
	const name = databaseName(url);
	const admin = new URL(url);
	admin.pathname = "/postgres";
	await withClient(admin.toString(), async (client) => {
		const found = await client.query("select 1 from pg_database where datname = $1", [name]);
		if (found.rowCount === 0) await client.query(`create database "${name.replaceAll('"', '""')}"`);
	});
}

export async function dropAllTables(url: string): Promise<void> {
	await withClient(url, async (client) => {
		await client.query("drop schema if exists drizzle cascade");
		await client.query("drop schema public cascade");
		await client.query("create schema public");
	});
}

export async function truncateAllTables(url: string): Promise<void> {
	await withClient(url, async (client) => {
		const { rows } = await client.query<{ tablename: string }>(
			"select tablename from pg_tables where schemaname = 'public'",
		);
		const tables = rows.map((r) => r.tablename).filter((t) => !MIGRATION_TABLES.includes(t));
		if (tables.length > 0) {
			await client.query(
				`truncate table ${tables.map((t) => `"${t}"`).join(", ")} restart identity cascade`,
			);
		}
	});
}
