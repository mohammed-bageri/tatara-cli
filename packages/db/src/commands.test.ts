import { runCommand } from "@tatara/core";
import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";
import { dbCommands } from "./commands.ts";

const logger = pino({ level: "silent" });

function setup(nodeEnv = "development") {
	const calls: string[] = [];
	const commands = dbCommands({
		env: { DATABASE_URL: "postgres://x", NODE_ENV: nodeEnv },
		migrateDatabase: vi.fn(async () => void calls.push("migrate")),
		dropAllTables: vi.fn(async () => void calls.push("drop")),
		seeds: [
			{ name: "b", run: async () => void calls.push("seed b") },
			{ name: "a", order: 0, run: async () => void calls.push("seed a") },
		],
	});
	return { calls, run: (...argv: string[]) => runCommand(commands, argv, logger) };
}

describe("dbCommands", () => {
	it("migrates", async () => {
		const { calls, run } = setup();
		expect(await run("db:migrate")).toBe(0);
		expect(calls).toEqual(["migrate"]);
	});

	it("resets by dropping, then migrating", async () => {
		const { calls, run } = setup();
		expect(await run("db:reset")).toBe(0);
		expect(calls).toEqual(["drop", "migrate"]);
	});

	it("refuses to reset in production, and --force false does not count as forcing", async () => {
		for (const argv of [
			["db:reset"],
			["db:reset", "--force", "false"],
			["db:reset", "--force=0"],
		]) {
			const { calls, run } = setup("production");
			expect(await run(...(argv as [string]))).toBe(1);
			expect(calls).toEqual([]);
		}
		const { calls, run } = setup("production");
		expect(await run("db:reset", "--force")).toBe(0);
		expect(calls).toEqual(["drop", "migrate"]);
	});

	it("seeds in order", async () => {
		const { calls, run } = setup();
		expect(await run("db:seed")).toBe(0);
		expect(calls).toEqual(["seed a", "seed b"]);
	});
});
