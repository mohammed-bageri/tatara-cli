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
} {
	return {
		completed: () =>
			withConnection(url, async (c) => {
				const [rows] = await c.query<mysql.RowDataPacket[]>(
					"select name from tatara_command_runs where phase = 'once'",
				);
				return new Set((rows as { name: string }[]).map((r) => String(r.name)));
			}),
		record: ({ name, phase, durationMs }) =>
			withConnection(url, async (c) => {
				await c.query(
					"insert into tatara_command_runs (name, phase, duration_ms) values (?, ?, ?) on duplicate key update phase = values(phase), ran_at = current_timestamp(3), duration_ms = values(duration_ms)",
					[name, phase, durationMs],
				);
			}),
	};
}
