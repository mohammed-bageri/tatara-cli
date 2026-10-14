import type { z } from "zod";
import type { Logger } from "#core/logging/logger";

export interface JobContext {
	logger: Logger;
	jobId: string;
	attempt: number;
}

export interface ConsumerDefinition<S extends z.ZodType = z.ZodType> {
	/** job name, e.g. "billing.invoice-paid" */
	topic: string;
	description: string;
	schema: S;
	/** retries before the job is marked failed (default 3) */
	attempts?: number;
	handle(data: z.infer<S>, ctx: JobContext): Promise<void>;
}

/** Default export of every `consumers/*.ts`; run by the worker app. */
export function defineConsumer<S extends z.ZodType>(definition: ConsumerDefinition<S>) {
	return definition;
}

export interface ScheduleDefinition {
	name: string;
	/** cron expression (seconds optional), evaluated in UTC */
	cron: string;
	/** how long the run holds its lock; one run per tick across all cron processes */
	lockTtlMs?: number;
	run(ctx: { logger: Logger }): Promise<void>;
}

/** Default export of every `schedules/*.ts`; run by the cron app. */
export function defineSchedule(definition: ScheduleDefinition): ScheduleDefinition {
	return definition;
}
