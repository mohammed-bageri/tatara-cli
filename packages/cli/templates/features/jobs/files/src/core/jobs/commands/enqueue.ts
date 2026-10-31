import { z } from "zod";
import { defineCommand } from "@tatara/core";
import { enqueue } from "#core/jobs/index";

export default defineCommand({
	name: "jobs:enqueue",
	description: "Enqueue a job by topic with a JSON payload (for development and debugging)",
	args: z.object({ topic: z.string().min(1), data: z.string().default("{}") }),
	async run({ topic, data }, { logger }) {
		const id = await enqueue(topic, JSON.parse(data) as unknown);
		logger.info({ topic, id }, "job enqueued");
	},
});
