import { pino } from "pino";
import { env } from "#core/config/env";

export const logger = pino({
	level: env.LOG_LEVEL,
	base: { service: "__APP_NAME__" },
	...(env.NODE_ENV === "development"
		? {
				transport: {
					target: "pino-pretty",
					options: { colorize: true, ignore: "pid,hostname,service" },
				},
			}
		: {}),
});

export type Logger = typeof logger;
