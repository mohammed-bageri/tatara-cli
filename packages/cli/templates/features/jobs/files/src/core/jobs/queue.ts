import { type JobsOptions, Queue } from "bullmq";
import { env } from "#core/config/env";
import { redis } from "#core/jobs/redis";
import { onShutdown } from "#core/process/lifecycle";

export const QUEUE_NAME = "__APP_NAME__-jobs";

let queue: Queue | undefined;

function getQueue(): Queue {
	if (!queue) {
		const q = new Queue(QUEUE_NAME, { connection: redis(), prefix: env.JOBS_PREFIX });
		queue = q;
		onShutdown("queue", () => q.close());
	}
	return queue;
}

/** Enqueues a job for the consumer with this topic. The consumer validates the payload. */
export async function enqueue(topic: string, data: unknown, options: JobsOptions = {}): Promise<string> {
	const job = await getQueue().add(topic, data, {
		attempts: 3,
		backoff: { type: "exponential", delay: 1000 },
		removeOnComplete: 1000,
		removeOnFail: 5000,
		...options,
	});
	return job.id ?? "";
}
