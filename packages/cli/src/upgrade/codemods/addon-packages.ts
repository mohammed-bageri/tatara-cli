import { versionOf } from "../../paths.ts";
import type { Codemod } from "../codemods.ts";
import { applyGroup, blockersOf, type Group, sourceFiles } from "./groups.ts";

const groups: Record<string, Group> = {
	storage: {
		name: "storage",
		regenerate: [
			"src/core/storage/index.ts",
			"src/core/storage/commands/check.ts",
			"src/core/storage/tests/storage.test.ts",
		],
		remove: ["storage.ts", "local.ts", "s3.ts"].map((f) => `src/core/storage/${f}`),
		rewrites: [
			{ from: "#core/storage/storage", to: "@tatara/storage" },
			// localStorage(root) and the S3 helpers take their settings as arguments now
			{ from: "#core/storage/local", to: "@tatara/storage", names: [] },
			{ from: "#core/storage/s3", to: "#core/storage/index", names: ["s3"] },
		],
	},
	email: { name: "email", regenerate: ["src/core/email/send.ts"], remove: [], rewrites: [] },
	i18n: { name: "i18n", regenerate: ["src/core/i18n/index.ts"], remove: [], rewrites: [] },
	jobs: {
		name: "jobs",
		regenerate: [
			"src/core/jobs/index.ts",
			"src/apps/worker/index.ts",
			"src/apps/cron/index.ts",
			"src/core/jobs/commands/enqueue.ts",
			"src/modules/example/tests/jobs.test.ts",
		],
		remove: ["define.ts", "process.ts", "lock.ts", "redis.ts", "queue.ts"].map(
			(f) => `src/core/jobs/${f}`,
		),
		rewrites: [
			{ from: "#core/jobs/define", to: "@tatara/jobs" },
			{ from: "#core/jobs/process", to: "@tatara/jobs" },
			{ from: "#core/jobs/queue", to: "#core/jobs/index", names: ["enqueue", "QUEUE_NAME"] },
			{ from: "#core/jobs/redis", to: "#core/jobs/index", names: ["redis"] },
			// withLock takes the Redis connection as its first argument now
			{ from: "#core/jobs/lock", to: "@tatara/jobs", names: [] },
		],
	},
};

/** Written even though the app has no copy yet; other files are only replaced when present. */
const NEW = new Set(["src/core/jobs/index.ts"]);

export const addonPackages: Codemod = {
	version: "0.7.0",
	id: "addon-packages",
	description: "Use @tatara/storage, @tatara/email, @tatara/i18n and @tatara/jobs",
	async run(ctx) {
		const addons = ctx.project.config.addons as string[];
		const sources = await sourceFiles(ctx);
		// decide everything before changing anything
		const ready: Group[] = [];
		for (const [addon, group] of Object.entries(groups)) {
			if (!addons.includes(addon)) continue;
			await ctx.addDependency(`@tatara/${addon}`, versionOf(`@tatara/${addon}`));
			const blockers = await blockersOf(ctx, group, sources);
			if (blockers.length > 0) {
				ctx.report.notes.push(
					`${addon} was not moved onto @tatara/${addon}: ${blockers.join("; ")}. Compare with a newly generated app and move it by hand.`,
				);
				continue;
			}
			const present: string[] = [];
			for (const path of group.regenerate) {
				const exists = await ctx.read(path).then(
					() => true,
					() => false,
				);
				if (exists || NEW.has(path)) present.push(path);
			}
			ready.push({ ...group, regenerate: present });
		}
		for (const group of ready) await applyGroup(ctx, group);
	},
};
