import { versionOf } from "../../paths.ts";
import type { Codemod } from "../codemods.ts";
import type { UpgradeContext } from "../context.ts";

/** Generated jobs wiring that 0.11 replaces when the app hasn't changed it. */
const REGENERATED = [
	"src/core/jobs/index.ts",
	"src/apps/worker/index.ts",
	"src/apps/cron/index.ts",
	"src/modules/example/tests/jobs.test.ts",
	"src/core/config/env.ts",
	".env.example",
	".env.test",
];

/** New in 0.11; written only where the app has nothing. */
const ADDED = [
	"src/apps/cron/runner.ts",
	"src/core/jobs/outbox.ts",
	"src/core/cache/index.ts",
	"src/core/http/rate-limit.ts",
];

async function read(ctx: UpgradeContext, path: string) {
	return ctx.read(path).catch(() => undefined);
}

/** Jobs over drivers (inline, Postgres outbox, BullMQ, Kafka); schedules lock with the cache. */
export const jobsDrivers: Codemod = {
	version: "0.11.0",
	id: "jobs-drivers",
	description:
		"Jobs drivers (JOBS_DRIVER), typed enqueue, dead letters, schedule triggers; jobs bring the cache",
	async run(ctx) {
		const { config } = ctx.project;
		if (!config.addons.includes("jobs")) return;
		if (!config.addons.includes("cache")) {
			config.addons.push("cache");
			const raw = JSON.parse(await ctx.read("tatara.json")) as { addons: string[] };
			raw.addons = [...new Set([...raw.addons, "cache"])];
			await ctx.write("tatara.json", `${JSON.stringify(raw, null, "\t")}\n`);
			await ctx.addDependency("@tatara/cache", versionOf("@tatara/cache"));
		}
		await ctx.addDependency("kafkajs", versionOf("kafkajs"));

		for (const path of ADDED) {
			if ((await read(ctx, path)) !== undefined) continue;
			const text = await ctx.renderCurrent(path);
			if (text !== undefined) await ctx.write(path, text);
		}
		const customised: string[] = [];
		for (const path of REGENERATED) {
			const text = await read(ctx, path);
			if (text === undefined) continue;
			if (await ctx.baseline.isUnchanged(path, text)) await ctx.regenerate(path);
			else customised.push(path);
		}
		if (customised.length > 0)
			ctx.report.notes.push(
				`Compare ${customised.join(", ")} with a newly generated app: the queue is now \`jobs\` (createJobs over the JOBS_DRIVER driver), startWorker takes { driver: jobs.driver, consumers, … }, and startCron takes the schedule runner in src/apps/cron/runner.ts (it locks with the cache).`,
			);
		ctx.report.notes.push(
			"Jobs now pick a driver with JOBS_DRIVER (bullmq stays the default; tests use inline). onDeadLetter runs once, after the last attempt. The app now has the cache add-on, which schedules lock with.",
		);
	},
};
