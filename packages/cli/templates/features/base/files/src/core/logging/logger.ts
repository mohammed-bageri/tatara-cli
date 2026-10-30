import { loggerOptions } from "@tatara/core";
import { pino } from "pino";
import { env } from "#core/config/env";

export const logger = pino(
	loggerOptions({ env: env.NODE_ENV, level: env.LOG_LEVEL, service: "__APP_NAME__" }),
);

export type Logger = typeof logger;
