import { handleSignals } from "@tatara/core";
import { startCron } from "@tatara/jobs";
import { logger } from "#core/logging/logger";
import { scheduleRunner } from "#apps/cron/runner";

startCron({ ...scheduleRunner, logger });
handleSignals(logger);
