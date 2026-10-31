import type { CoreLogger } from "@tatara/core";
import type { z } from "zod";

export interface JobContext {
	logger: CoreLogger;
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
	run(ctx: { logger: CoreLogger }): Promise<void>;
}

/** Default export of every `schedules/*.ts`; run by the cron app. */
export function defineSchedule(definition: ScheduleDefinition): ScheduleDefinition {
	return definition;
}

export class UnknownTopicError extends Error {}

/** Validates and runs one job; shared by the worker and by tests. */
export async function processJob(
	consumers: ConsumerDefinition[],
	topic: string,
	data: unknown,
	ctx: JobContext,
): Promise<void> {
	const consumer = consumers.find((c) => c.topic === topic);
	if (!consumer) throw new UnknownTopicError(`No consumer for topic "${topic}"`);
	const parsed = consumer.schema.safeParse(data);
	if (!parsed.success) {
		throw new Error(`Invalid payload for ${topic}: ${parsed.error.message}`);
	}
	await consumer.handle(parsed.data, ctx);
}
