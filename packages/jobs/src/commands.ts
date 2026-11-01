import { type CommandDefinition, defineCommand } from "@tatara/core";
import { z } from "zod";
import type { ScheduleDefinition } from "./define.ts";
import { runSchedule, type ScheduleRunOptions, triggerTick } from "./schedules.ts";

/** jobs:enqueue and schedule:run; wired into the app by `tatara sync`. */
export function jobsCommands({
	jobs,
	scheduleRunner,
}: {
	jobs: { enqueue(topic: never, data: never, options?: { orgId?: string }): Promise<string> };
	scheduleRunner?: { schedules: ScheduleDefinition[] } & Omit<ScheduleRunOptions, "logger">;
}): CommandDefinition[] {
	const enqueue = jobs.enqueue as (
		topic: string,
		data: unknown,
		options?: { orgId?: string },
	) => Promise<string>;
	return [
		defineCommand({
			name: "jobs:enqueue",
			description: "Enqueue a job by topic with a JSON payload (for development and debugging)",
			args: z.object({
				topic: z.string().min(1),
				data: z.string().default("{}"),
				org: z.string().optional(),
			}),
			async run({ topic, data, org }, { logger }) {
				const id = await enqueue(topic, JSON.parse(data) as unknown, { orgId: org });
				logger.info({ topic, id }, "job enqueued");
			},
		}),
		defineCommand({
			name: "schedule:run",
			description:
				"Run a schedule now, under the same lock as the cron app (for a platform scheduler)",
			args: z.object({ name: z.string().min(1) }),
			async run({ name }, { logger }) {
				const schedule = scheduleRunner?.schedules.find((s) => s.name === name);
				if (!scheduleRunner || !schedule) throw new Error(`No schedule named "${name}"`);
				const ran = await runSchedule(schedule, triggerTick(), { ...scheduleRunner, logger });
				logger.info(
					{ schedule: name, ran },
					ran ? "schedule ran" : "schedule already ran this minute",
				);
			},
		}),
	] as CommandDefinition[];
}
