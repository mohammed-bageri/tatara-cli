import mysql from "mysql2/promise";

const MIGRATION_TABLES = ["__drizzle_migrations", "_prisma_migrations"];

function databaseName(url: string): string {
	return decodeURIComponent(new URL(url).pathname.slice(1));
}

async function withConnection<T>(url: string, fn: (c: mysql.Connection) => Promise<T>): Promise<T> {
	const connection = await mysql.createConnection({ uri: url, multipleStatements: true });
	try {
		return await fn(connection);
	} finally {
		await connection.end();
	}
}

/** Creates the database named in `url` if it does not exist. */
export async function ensureDatabase(url: string): Promise<void> {
	const name = databaseName(url);
	const server = new URL(url);
	server.pathname = "/";
	await withConnection(server.toString(), async (c) => {
		await c.query(`create database if not exists \`${name.replaceAll("`", "``")}\``);
	});
}

async function tables(c: mysql.Connection): Promise<string[]> {
	const [rows] = await c.query<mysql.RowDataPacket[]>(
		"select table_name as name from information_schema.tables where table_schema = database() and table_type = 'BASE TABLE'",
	);
	return rows.map((r) => String(r.name));
}

export async function dropAllTables(url: string): Promise<void> {
	await withConnection(url, async (c) => {
		const names = await tables(c);
		if (names.length === 0) return;
		await c.query(
			`set foreign_key_checks = 0; drop table ${names.map((t) => `\`${t}\``).join(", ")}; set foreign_key_checks = 1;`,
		);
	});
}

export async function truncateAllTables(url: string): Promise<void> {
	await withConnection(url, async (c) => {
		const names = (await tables(c)).filter((t) => !MIGRATION_TABLES.includes(t));
		if (names.length === 0) return;
		await c.query(
			`set foreign_key_checks = 0; ${names.map((t) => `truncate table \`${t}\`;`).join(" ")} set foreign_key_checks = 1;`,
		);
	});
}
