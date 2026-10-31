import { handleSignals } from "@tatara/core";
import { startCron } from "@tatara/jobs";
import { redis } from "#core/jobs/index";
import { logger } from "#core/logging/logger";
import { schedules } from "#generated/schedules";

startCron({ schedules, redis, logger });
handleSignals(logger);
