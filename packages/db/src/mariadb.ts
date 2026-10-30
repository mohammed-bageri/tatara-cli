import * as mariadb from "mariadb";

const MIGRATION_TABLES = ["__drizzle_migrations", "_prisma_migrations"];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * mariadb connection options from a mysql:// URL. Public-key retrieval (needed by MySQL's
 * caching_sha2_password without TLS) is only enabled for local hosts or when the URL asks
 * for it; use `?ssl=true` for remote databases.
 */
export function connectionConfig(url: string): mariadb.ConnectionConfig {
	const u = new URL(url);
	const param = (name: string) => u.searchParams.get(name);
	return {
		host: u.hostname,
		port: Number(u.port || 3306),
		user: decodeURIComponent(u.username),
		password: decodeURIComponent(u.password),
		database: decodeURIComponent(u.pathname.slice(1)) || undefined,
		allowPublicKeyRetrieval:
			param("allowPublicKeyRetrieval") === "true" || LOCAL_HOSTS.has(u.hostname),
		...(param("ssl") === "true" ? { ssl: { rejectUnauthorized: true } } : {}),
	};
}

const adminConfig = (url: string): mariadb.ConnectionConfig => ({
	...connectionConfig(url),
	multipleStatements: true,
});

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
	const config = adminConfig(url);
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
	await withConnection(adminConfig(url), async (c) => {
		const names = await tables(c);
		if (names.length === 0) return;
		await c.query(
			`set foreign_key_checks = 0; drop table ${names.map((t) => `\`${t}\``).join(", ")}; set foreign_key_checks = 1;`,
		);
	});
}

export async function truncateAllTables(url: string): Promise<void> {
	await withConnection(adminConfig(url), async (c) => {
		const names = (await tables(c)).filter((t) => !MIGRATION_TABLES.includes(t));
		if (names.length === 0) return;
		await c.query(
			`set foreign_key_checks = 0; ${names.map((t) => `truncate table \`${t}\`;`).join(" ")} set foreign_key_checks = 1;`,
		);
	});
}
