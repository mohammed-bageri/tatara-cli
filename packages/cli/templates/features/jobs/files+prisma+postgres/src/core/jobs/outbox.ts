import { onShutdown } from "@tatara/core";
import type { Queryable } from "@tatara/jobs/postgres";
import pg from "pg";
import { env } from "#core/config/env";
import type { Executor } from "#core/db/client";

/** A small pool for the Postgres job driver (Prisma keeps its own connections to itself). */
export const outboxPool: Queryable = new pg.Pool({ connectionString: env.DATABASE_URL, max: 5 });
onShutdown("jobs-pool", () => (outboxPool as pg.Pool).end());

/**
 * `enqueue(topic, data, { executor: inTransaction(tx) })`: with JOBS_DRIVER=postgres the job is
 * written in `tx`, so it exists exactly when the transaction commits.
 */
export function inTransaction(executor: Executor): Queryable {
	return { query: (text, values = []) => executor.$executeRawUnsafe(text, ...values) };
}
