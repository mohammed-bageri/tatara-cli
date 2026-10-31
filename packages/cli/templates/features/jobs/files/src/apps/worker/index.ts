import { handleSignals } from "@tatara/core";
import { startWorker } from "@tatara/jobs";
import { env } from "#core/config/env";
import { QUEUE_NAME, redis } from "#core/jobs/index";
import { logger } from "#core/logging/logger";
import { consumers } from "#generated/consumers";

startWorker({
	queue: QUEUE_NAME,
	prefix: env.JOBS_PREFIX,
	redis: redis(),
	concurrency: env.WORKER_CONCURRENCY,
	consumers,
	logger,
});
handleSignals(logger);
