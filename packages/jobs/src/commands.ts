import { type CommandDefinition, defineCommand } from "@tatara/core";
import { z } from "zod";

/** jobs:enqueue; wired into the app by `tatara sync`. */
export function jobsCommands({
	enqueue,
}: {
	enqueue(topic: string, data: unknown): Promise<string>;
}): CommandDefinition[] {
	return [
		defineCommand({
			name: "jobs:enqueue",
			description: "Enqueue a job by topic with a JSON payload (for development and debugging)",
			args: z.object({ topic: z.string().min(1), data: z.string().default("{}") }),
			async run({ topic, data }, { logger }) {
				const id = await enqueue(topic, JSON.parse(data) as unknown);
				logger.info({ topic, id }, "job enqueued");
			},
		}),
	] as CommandDefinition[];
}
