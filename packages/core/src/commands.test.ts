import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { type CoreLogger, defineCommand, flag, parseFlags, runCommand } from "./index.ts";

function fakeLogger() {
	const logger = {
		errors: [] as unknown[],
		bindings: [] as object[],
		info: () => {},
		error: (o: unknown) => {
			logger.errors.push(o);
		},
		child: (b: object): unknown => {
			logger.bindings.push(b);
			return logger;
		},
	};
	return logger as typeof logger & CoreLogger;
}

describe("flag()", () => {
	const args = z.object({ force: flag() });
	const parse = (argv: string[]) => args.parse(parseFlags(argv)).force;
	it("is true for a bare flag", () => expect(parse(["--force"])).toBe(true));
	it("reads --flag false as false", () => expect(parse(["--force", "false"])).toBe(false));
	it("reads --flag=0 as false", () => expect(parse(["--force=0"])).toBe(false));
	it("reads --flag true as true", () => expect(parse(["--force", "true"])).toBe(true));
	it("defaults to false", () => expect(parse([])).toBe(false));
	it("rejects anything else", () => expect(() => parse(["--force", "maybe"])).toThrow());
});

describe("parseFlags", () => {
	it("camel-cases dashed keys", () => expect(parseFlags(["--dry-run"])).toEqual({ dryRun: true }));
});

describe("runCommand", () => {
	const ok = defineCommand({ name: "a:ok", description: "ok", run: vi.fn() });
	const typed = defineCommand({
		name: "a:typed",
		description: "typed",
		args: z.object({ n: z.coerce.number() }),
		run: () => {},
	});
	const broken = defineCommand({
		name: "a:broken",
		description: "broken",
		run: () => {
			throw new Error("boom");
		},
	});

	it("lists commands for --list", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		expect(await runCommand([ok], ["--list"], fakeLogger())).toBe(0);
		expect(log.mock.calls.flat().join("\n")).toContain("a:ok");
		log.mockRestore();
	});

	it("returns 1 for an unknown command", async () => {
		const err = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(await runCommand([ok], ["nope"], fakeLogger())).toBe(1);
		err.mockRestore();
	});

	it("returns 1 and lists issues for invalid args", async () => {
		const err = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(await runCommand([typed], ["a:typed", "--n", "x"], fakeLogger())).toBe(1);
		expect(err.mock.calls.flat().join("\n")).toContain("--n");
		err.mockRestore();
	});

	it("returns 1 and logs when the command throws", async () => {
		const logger = fakeLogger();
		expect(await runCommand([broken], ["a:broken"], logger)).toBe(1);
		expect(logger.errors).toHaveLength(1);
	});

	it("passes a child logger named after the command", async () => {
		const logger = fakeLogger();
		expect(await runCommand([ok], ["a:ok"], logger)).toBe(0);
		expect(logger.bindings).toContainEqual({ command: "a:ok" });
	});
});
