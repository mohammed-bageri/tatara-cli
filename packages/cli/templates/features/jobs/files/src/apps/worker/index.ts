import { Worker } from "bullmq";
import { env } from "#core/config/env";
import { processJob } from "#core/jobs/process";
import { QUEUE_NAME } from "#core/jobs/queue";
import { redis } from "#core/jobs/redis";
import { logger } from "#core/logging/logger";
import { handleSignals, onShutdown } from "@tatara/core";
import { consumers } from "#generated/consumers";

const worker = new Worker(
	QUEUE_NAME,
	(job) =>
		processJob(consumers, job.name, job.data, {
			logger: logger.child({ jobId: job.id, topic: job.name }),
			jobId: job.id ?? "",
			attempt: job.attemptsMade + 1,
		}),
	{ connection: redis(), prefix: env.JOBS_PREFIX, concurrency: env.WORKER_CONCURRENCY },
);

worker.on("failed", (job, err) => logger.error({ err, jobId: job?.id, topic: job?.name }, "job failed"));
onShutdown("worker", () => worker.close());
handleSignals(logger);
logger.info({ topics: consumers.map((c) => c.topic) }, "worker started");
