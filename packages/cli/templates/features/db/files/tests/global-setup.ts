import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { prepareTestDatabases } from "@tatara/testing";
import { ensureDatabase } from "#core/db/admin";
import { migrateDatabase } from "#core/db/migrate";

/** Creates and migrates one database per test worker, once per run. */
export default async function setup() {
	const fileEnv = existsSync(".env.test")
		? (parseEnv(readFileSync(".env.test", "utf8")) as Record<string, string>)
		: {};
	const baseUrl = process.env.DATABASE_URL ?? fileEnv.DATABASE_URL;
	if (!baseUrl) throw new Error("DATABASE_URL is not set for tests (.env.test)");
	await prepareTestDatabases({ baseUrl, ensureDatabase, migrateDatabase });
}
