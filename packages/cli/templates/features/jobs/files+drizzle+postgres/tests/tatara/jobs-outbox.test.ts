import { createJobs, type TopicsOf } from "@tatara/jobs";
import { postgresDriver } from "@tatara/jobs/postgres";
import { describe, expect, it } from "vitest";
import { db } from "#core/db/client";
import { inTransaction, outboxPool } from "#core/jobs/outbox";
import type { consumers } from "#generated/consumers";

const jobs = createJobs<TopicsOf<typeof consumers>>({ driver: postgresDriver({ db: outboxPool }) });

async function stored(id: string): Promise<number> {
	const result = (await outboxPool.query("select count(*)::int as n from tatara.jobs where id = $1", [id])) as {
		rows: { n: number }[];
	};
	return result.rows[0]?.n ?? 0;
}

describe("the Postgres job outbox", () => {
	it("stores a job with the caller's transaction, and drops it on rollback", async () => {
		let rolledBack = "";
		await expect(
			db.transaction(async (tx) => {
				rolledBack = await jobs.enqueue("example.send-welcome", { name: "Ada" }, { executor: inTransaction(tx) });
				throw new Error("rollback");
			}),
		).rejects.toThrow("rollback");
		expect(await stored(rolledBack)).toBe(0);

		const committed = await db.transaction(async (tx) =>
			jobs.enqueue("example.send-welcome", { name: "Ada" }, { executor: inTransaction(tx) }),
		);
		expect(await stored(committed)).toBe(1);
		await outboxPool.query("delete from tatara.jobs where id = $1", [committed]);
	});
});
