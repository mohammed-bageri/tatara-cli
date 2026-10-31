import { onShutdown } from "@tatara/core";
import { type JobsOptions, Queue } from "bullmq";
import type { Redis } from "ioredis";

export interface QueueOptions {
	name: string;
	prefix: string;
	redis: () => Redis;
}

/** The app's queue, opened on first enqueue and closed on shutdown. */
export function createQueue(options: QueueOptions) {
	let queue: Queue | undefined;
	const get = () => {
		if (!queue) {
			const q = new Queue(options.name, { connection: options.redis(), prefix: options.prefix });
			queue = q;
			onShutdown("queue", () => q.close());
		}
		return queue;
	};
	return {
		/** Enqueues a job for the consumer with this topic. The consumer validates the payload. */
		async enqueue(topic: string, data: unknown, jobOptions: JobsOptions = {}): Promise<string> {
			const job = await get().add(topic, data, {
				attempts: 3,
				backoff: { type: "exponential", delay: 1000 },
				removeOnComplete: 1000,
				removeOnFail: 5000,
				...jobOptions,
			});
			return job.id ?? "";
		},
	};
}
