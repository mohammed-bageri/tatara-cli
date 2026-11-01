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
			// delete, not truncate: MySQL runs truncate as DDL (~300ms a table), too slow per test
			`set foreign_key_checks = 0; ${names.map((t) => `delete from \`${t}\`;`).join(" ")} set foreign_key_checks = 1;`,
		);
	});
}

/**
 * The command ledger in `tatara_command_runs`: which "once" commands this database has run. The
 * table is the app's own (its ORM schema and migrations), so migration tools see no drift.
 */
export function commandLedger(url: string): {
	completed(): Promise<Set<string>>;
	record(run: { name: string; phase: "deploy" | "once"; durationMs: number }): Promise<void>;
	exclusive<T>(fn: () => Promise<T>): Promise<T>;
} {
	return {
		// a named lock on its own connection, held while the deploy runs (waits up to 10 min)
		exclusive: (fn) =>
			withConnection(adminConfig(url), async (c) => {
				const rows: { got: number }[] = await c.query(
					"select get_lock('tatara:deploy', 600) as got",
				);
				const got = Number(rows[0]?.got);
				if (Number(got) !== 1) throw new Error("another deploy is still running");
				try {
					return await fn();
				} finally {
					await c.query("select release_lock('tatara:deploy')");
				}
			}),
		completed: () =>
			withConnection(adminConfig(url), async (c) => {
				const rows: { name: string }[] = await c.query(
					"select name from tatara_command_runs where phase = 'once'",
				);
				return new Set((rows as { name: string }[]).map((r) => String(r.name)));
			}),
		record: ({ name, phase, durationMs }) =>
			withConnection(adminConfig(url), async (c) => {
				await c.query(
					"insert into tatara_command_runs (name, phase, duration_ms) values (?, ?, ?) on duplicate key update phase = values(phase), ran_at = current_timestamp(3), duration_ms = values(duration_ms)",
					[name, phase, durationMs],
				);
			}),
	};
}
