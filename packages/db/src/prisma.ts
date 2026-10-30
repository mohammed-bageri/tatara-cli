import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Applies prisma/migrations to the database at `url` (`prisma migrate deploy` from the app's root). */
export async function migrateDatabase(url: string, options: { cwd?: string } = {}): Promise<void> {
	const cwd = options.cwd ?? process.cwd();
	await run(resolve(cwd, "node_modules/.bin/prisma"), ["migrate", "deploy"], {
		cwd,
		// passed through so the Prisma CLI finds PATH and its own settings; not read as config here
		env: { ...process.env, DATABASE_URL: url },
	});
}
