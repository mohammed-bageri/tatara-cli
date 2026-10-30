import type { Logger, LoggerOptions } from "pino";

/** The app's pino logger; commands and shutdown hooks log through it. */
export type CoreLogger = Logger;

type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

const SEVERITIES: Record<string, Severity> = {
	trace: "DEBUG",
	debug: "DEBUG",
	info: "INFO",
	warn: "WARNING",
	error: "ERROR",
	fatal: "CRITICAL",
};

/** Cloud Logging reads `severity`, not pino's numeric `level`. */
export function levelToSeverity(label: string): Severity {
	return SEVERITIES[label] ?? "INFO";
}

export interface LoggerConfig {
	env: "development" | "test" | "production";
	level: string;
	/** written to every line as `service` */
	service: string;
}

/** pino options: pretty in development, Cloud Logging fields in production, plain in test. */
export function loggerOptions({ env, level, service }: LoggerConfig): LoggerOptions {
	const base: LoggerOptions = { level, base: { service } };
	if (env === "development") {
		return {
			...base,
			transport: {
				target: "pino-pretty",
				options: { colorize: true, ignore: "pid,hostname,service" },
			},
		};
	}
	if (env === "production") {
		return {
			...base,
			messageKey: "message",
			formatters: {
				level: (label, number) => ({ severity: levelToSeverity(label), level: number }),
			},
		};
	}
	return base;
}
