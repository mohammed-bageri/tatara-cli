import type { CoreLogger } from "@tatara/core";
import {
	type ConsumerDefinition,
	type InvalidPayloadError,
	type JobEnvelope,
	parsePayload,
	UnknownTopicError,
} from "./define.ts";

export type Outcome =
	| { status: "done" }
	| { status: "retry"; delayMs: number; error: unknown }
	| { status: "dead"; error: unknown };

const MAX_BACKOFF_MS = 60 * 60 * 1000;

/** Doubles from `baseMs` per attempt, capped at an hour. */
export function backoffDelay(baseMs: number, attempt: number): number {
	return Math.min(MAX_BACKOFF_MS, baseMs * 2 ** Math.max(0, attempt - 1));
}

/** Where a driver takes a job from, and what it hands back to the store. */
export type JobHandler = (job: JobEnvelope) => Promise<Outcome>;

/**
 * Runs one delivery of a job and says what the driver should do next. Every driver uses this, so
 * validation, retries and the dead-letter hook behave the same on Redis, Postgres and Kafka.
 */
export function jobHandler(
	consumers: readonly ConsumerDefinition[],
	logger: CoreLogger,
): JobHandler {
	const byTopic = new Map(consumers.map((c) => [c.topic, c]));
	return async (job) => {
		const log = logger.child({ jobId: job.id, topic: job.topic, attempt: job.attempt });
		const ctx = { logger: log, jobId: job.id, attempt: job.attempt, orgId: job.orgId };
		const consumer = byTopic.get(job.topic);
		const dead = async (error: unknown): Promise<Outcome> => {
			log.error({ err: error }, "job dead");
			try {
				await consumer?.onDeadLetter?.(job.data, { ...ctx, error });
			} catch (hookError) {
				log.error({ err: hookError }, "onDeadLetter failed");
			}
			return { status: "dead", error };
		};
		if (!consumer) return dead(new UnknownTopicError(`No consumer for topic "${job.topic}"`));
		let data: unknown;
		try {
			data = parsePayload(consumer, job.data);
		} catch (error) {
			// a payload that doesn't validate never will: no retries
			return dead(error as InvalidPayloadError);
		}
		try {
			await consumer.handle(data as never, ctx);
			return { status: "done" };
		} catch (error) {
			// the consumer's own setting wins: a producer may not have known it
			if (job.attempt >= (consumer.attempts ?? job.maxAttempts)) return dead(error);
			const delayMs = backoffDelay(consumer.backoffMs ?? 1000, job.attempt);
			log.warn({ err: error, delayMs }, "job failed, retrying");
			return { status: "retry", delayMs, error };
		}
	};
}
