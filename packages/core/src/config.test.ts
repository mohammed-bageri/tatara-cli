import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createLocalDefault, levelToSeverity, loggerOptions } from "./index.ts";

describe("createLocalDefault", () => {
	it("applies the local default outside production", () => {
		expect(createLocalDefault(false)(z.url(), "http://x.test").parse(undefined)).toBe(
			"http://x.test",
		);
	});
	it("requires the value in production", () => {
		expect(() => createLocalDefault(true)(z.url(), "http://x.test").parse(undefined)).toThrow();
	});
});

describe("levelToSeverity", () => {
	it.each([
		["trace", "DEBUG"],
		["debug", "DEBUG"],
		["info", "INFO"],
		["warn", "WARNING"],
		["error", "ERROR"],
		["fatal", "CRITICAL"],
		["custom", "INFO"],
	])("maps %s to %s", (label, severity) => expect(levelToSeverity(label)).toBe(severity));
});

describe("loggerOptions", () => {
	it("writes severity, message and service in production", () => {
		const lines: string[] = [];
		const log = pino(loggerOptions({ env: "production", level: "info", service: "svc" }), {
			write: (line: string) => {
				lines.push(line);
			},
		});
		log.error("boom");
		expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
			severity: "ERROR",
			message: "boom",
			service: "svc",
		});
	});
	it("uses pino-pretty in development", () => {
		expect(
			loggerOptions({ env: "development", level: "info", service: "svc" }).transport,
		).toMatchObject({
			target: "pino-pretty",
		});
	});
	it("is plain in test", () => {
		expect(
			loggerOptions({ env: "test", level: "silent", service: "svc" }).transport,
		).toBeUndefined();
	});
});
