import { defineSchedule } from "#core/jobs/define";

export default defineSchedule({
	name: "example.heartbeat",
	cron: "*/5 * * * *",
	async run({ logger }) {
		logger.info("heartbeat");
	},
});
