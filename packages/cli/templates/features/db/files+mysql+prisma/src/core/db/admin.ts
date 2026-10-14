import * as mariadb from "mariadb";

const MIGRATION_TABLES = ["__drizzle_migrations", "_prisma_migrations"];

export function connectionConfig(url: string, database?: string): mariadb.ConnectionConfig {
	const u = new URL(url);
	return {
		host: u.hostname,
		port: Number(u.port || 3306),
		user: decodeURIComponent(u.username),
		password: decodeURIComponent(u.password),
		database: database ?? (decodeURIComponent(u.pathname.slice(1)) || undefined),
		allowPublicKeyRetrieval: true,
		multipleStatements: true,
	};
}

async function withConnection<T>(
	config: mariadb.ConnectionConfig,
	fn: (c: mariadb.Connection) => Promise<T>,
): Promise<T> {
	const connection = await mariadb.createConnection(config);
	try {
		return await fn(connection);
	} finally {
		await connection.end();
	}
}

/** Creates the database named in `url` if it does not exist. */
export async function ensureDatabase(url: string): Promise<void> {
	const config = connectionConfig(url);
	const name = String(config.database);
	await withConnection({ ...config, database: undefined }, async (c) => {
		await c.query(`create database if not exists \`${name.replaceAll("`", "``")}\``);
	});
}

async function tables(c: mariadb.Connection): Promise<string[]> {
	const rows: { name: string }[] = await c.query(
		"select table_name as name from information_schema.tables where table_schema = database() and table_type = 'BASE TABLE'",
	);
	return rows.map((r) => String(r.name));
}

export async function dropAllTables(url: string): Promise<void> {
	await withConnection(connectionConfig(url), async (c) => {
		const names = await tables(c);
		if (names.length === 0) return;
		await c.query(
			`set foreign_key_checks = 0; drop table ${names.map((t) => `\`${t}\``).join(", ")}; set foreign_key_checks = 1;`,
		);
	});
}

export async function truncateAllTables(url: string): Promise<void> {
	await withConnection(connectionConfig(url), async (c) => {
		const names = (await tables(c)).filter((t) => !MIGRATION_TABLES.includes(t));
		if (names.length === 0) return;
		await c.query(
			`set foreign_key_checks = 0; ${names.map((t) => `truncate table \`${t}\`;`).join(" ")} set foreign_key_checks = 1;`,
		);
	});
}
