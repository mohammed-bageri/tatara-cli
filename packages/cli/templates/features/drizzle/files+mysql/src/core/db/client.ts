import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "#core/config/env";
import { registerReadinessCheck } from "@tatara/core";
import { onShutdown } from "@tatara/core";
import * as schema from "#generated/schema";

export const pool = mysql.createPool({ uri: env.DATABASE_URL, connectionLimit: env.DATABASE_POOL_MAX });

export const db = drizzle({ client: pool, schema, mode: "default", casing: "snake_case" });

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** `db` or an open transaction; services take an Executor so callers can compose them. */
export type Executor = Database | Transaction;

registerReadinessCheck("database", async () => {
	await pool.query("select 1");
});
onShutdown("database", () => pool.end());
