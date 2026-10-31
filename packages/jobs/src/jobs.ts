import { randomUUID } from "node:crypto";
import {
	type ConsumerDefinition,
	type JobEnvelope,
	parsePayload,
	UnknownTopicError,
} from "./define.ts";
import type { JobDriver } from "./driver.ts";

export interface EnqueueOptions {
	/** the org the job acts for (default: none, platform work) */
	orgId?: string | null;
	/** wait this long before the first run */
	delayMs?: number;
	/** the caller's transaction: with the Postgres driver the job commits (or not) with it */
	executor?: unknown;
}

const DEFAULT_ATTEMPTS = 3;

/**
 * The app's job producer. `Topics` (topic → payload, `TopicsOf<typeof consumers>`) types it; pass
 * `consumers` too and a payload they would reject throws here instead of in the worker.
 */
export function createJobs<Topics extends object = Record<string, unknown>>(options: {
	driver: JobDriver;
	// biome-ignore lint/suspicious/noExplicitAny: any consumer, whatever its payload type
	consumers?: readonly ConsumerDefinition<string, any>[];
}) {
	const byTopic = options.consumers
		? new Map<string, ConsumerDefinition>(options.consumers.map((c) => [c.topic, c]))
		: undefined;
	return {
		driver: options.driver,
		/** Stores a job for the consumer with this topic. Consumers validate it again when it runs. */
		async enqueue<T extends keyof Topics & string>(
			topic: T,
			data: Topics[T],
			opts: EnqueueOptions = {},
		): Promise<string> {
			const consumer = byTopic?.get(topic);
			if (byTopic && !consumer) throw new UnknownTopicError(`No consumer for topic "${topic}"`);
			if (consumer) parsePayload(consumer, data);
			const job: JobEnvelope = {
				id: randomUUID(),
				topic,
				data,
				orgId: opts.orgId ?? null,
				attempt: 1,
				maxAttempts: consumer?.attempts ?? DEFAULT_ATTEMPTS,
				enqueuedAt: new Date().toISOString(),
			};
			await options.driver.send([{ job, delayMs: opts.delayMs ?? 0 }], opts.executor);
			return job.id;
		},
	};
}
