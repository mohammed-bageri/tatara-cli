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
		// the cache, jobs and command ledger live here: a reset starts them over too
		await client.query("drop schema if exists tatara cascade");
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

/** The command ledger in `tatara.command_runs`: which "once" commands this database has run. */
export function commandLedger(url: string): {
	completed(): Promise<Set<string>>;
	record(run: { name: string; phase: "deploy" | "once"; durationMs: number }): Promise<void>;
} {
	const ensure = (client: pg.Client) =>
		client
			.query("create schema if not exists tatara")
			.then(() =>
				client.query(
					"create table if not exists tatara.command_runs (name text primary key, phase text not null, ran_at timestamptz not null default now(), duration_ms integer not null)",
				),
			);
	return {
		completed: () =>
			withClient(url, async (client) => {
				await ensure(client);
				const { rows } = await client.query<{ name: string }>(
					"select name from tatara.command_runs where phase = 'once'",
				);
				return new Set(rows.map((r) => r.name));
			}),
		record: ({ name, phase, durationMs }) =>
			withClient(url, async (client) => {
				await ensure(client);
				await client.query(
					"insert into tatara.command_runs (name, phase, duration_ms) values ($1, $2, $3) on conflict (name) do update set phase = excluded.phase, ran_at = now(), duration_ms = excluded.duration_ms",
					[name, phase, durationMs],
				);
			}),
	};
}
