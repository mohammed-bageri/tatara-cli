import { consoleSmsSender, type SmsSender } from "@tatara/auth";
import { logger } from "#core/logging/logger";

/** Logs instead of sending. Replace with an SmsSender for your provider. */
export const smsSender: SmsSender = consoleSmsSender(logger);
