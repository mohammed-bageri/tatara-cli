import { handleSignals } from "@tatara/core";
import { startWorker } from "@tatara/jobs";
import { env } from "#core/config/env";
import { jobs } from "#core/jobs/index";
import { logger } from "#core/logging/logger";
import { consumers } from "#generated/consumers";

await startWorker({ driver: jobs.driver, consumers, concurrency: env.WORKER_CONCURRENCY, logger });
handleSignals(logger);
