import { type SQL, sql } from "drizzle-orm";
import type { Queryable } from "@tatara/jobs/postgres";
import { type Executor, pool } from "#core/db/client";

/** The app's own pool: the Postgres driver needs no connection of its own. */
export const outboxPool: Queryable = pool;

/**
 * `enqueue(topic, data, { executor: inTransaction(tx) })`: with JOBS_DRIVER=postgres the job is
 * written in `tx`, so it exists exactly when the transaction commits.
 */
export function inTransaction(executor: Executor): Queryable {
	return {
		query(text, values = []) {
			// $1, $2… become drizzle parameters
			const parts = text.split(/\$(\d+)/);
			let query: SQL = sql.raw(parts[0] ?? "");
			for (let i = 1; i < parts.length; i += 2)
				query = sql`${query}${values[Number(parts[i]) - 1]}${sql.raw(parts[i + 1] ?? "")}`;
			return executor.execute(query);
		},
	};
}
