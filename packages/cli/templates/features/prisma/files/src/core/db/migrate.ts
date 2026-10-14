import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Applies prisma/migrations to the database at `url` (`prisma migrate deploy`). */
export async function migrateDatabase(url: string): Promise<void> {
	await run(resolve("node_modules/.bin/prisma"), ["migrate", "deploy"], {
		// tatara-check-ignore env-access: the Prisma CLI needs the full environment
		env: { ...process.env, DATABASE_URL: url },
	});
}
