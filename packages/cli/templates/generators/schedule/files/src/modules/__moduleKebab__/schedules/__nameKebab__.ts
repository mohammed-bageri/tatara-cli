import { defineSchedule } from "#core/jobs/define";

export default defineSchedule({
	name: "__moduleKebab__.__nameKebab__",
	// every day at 02:00 UTC
	cron: "0 2 * * *",
	lockTtlMs: 10 * 60_000,
	async run({ logger }) {
		logger.info("__moduleKebab__.__nameKebab__ ran");
	},
});
