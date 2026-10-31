import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	createQueue,
	defineConsumer,
	processJob,
	startCron,
	UnknownTopicError,
	withLock,
} from "./index.ts";

const add = vi.fn(async () => ({ id: "job-1" }));
vi.mock("bullmq", () => ({
	Queue: vi.fn(function Queue() {
		return { add, close: vi.fn() };
	}),
	Worker: vi.fn(),
}));

const logger = pino({ level: "silent" });
const ctx = { logger, jobId: "t", attempt: 1 };
const handled: string[] = [];
const consumers = [
	defineConsumer({
		topic: "example.send-welcome",
		description: "",
		schema: z.object({ name: z.string().min(1) }),
		async handle({ name }) {
			handled.push(name);
		},
	}),
];

/** set NX PX / compare-and-delete, as Redis does them. */
function fakeRedis() {
	const keys = new Map<string, string>();
	return {
		keys,
		async set(key: string, value: string, ..._rest: unknown[]) {
			if (keys.has(key)) return null;
			keys.set(key, value);
			return "OK" as const;
		},
		async eval(_script: string, _n: number, key: string, token: string) {
			if (keys.get(key) !== token) return 0;
			keys.delete(key);
			return 1;
		},
	};
}

describe("processJob", () => {
	it("runs the consumer for a topic with a valid payload", async () => {
		await processJob(consumers, "example.send-welcome", { name: "Ada" }, ctx);
		expect(handled).toContain("Ada");
	});

	it("rejects an invalid payload and an unknown topic", async () => {
		await expect(processJob(consumers, "example.send-welcome", { name: "" }, ctx)).rejects.toThrow(
			/Invalid payload/,
		);
		await expect(processJob(consumers, "nope", {}, ctx)).rejects.toBeInstanceOf(UnknownTopicError);
	});
});

describe("withLock", () => {
	it("lets only one holder run a locked section, and releases it after", async () => {
		const redis = fakeRedis();
		let inner: boolean | undefined;
		const outer = await withLock(redis as never, "k", 5000, async () => {
			inner = await withLock(redis as never, "k", 5000, async () => {});
		});
		expect(outer).toBe(true);
		expect(inner).toBe(false);
		expect(redis.keys.size).toBe(0);
	});

	it("releases the lock when the section throws", async () => {
		const redis = fakeRedis();
		await expect(
			withLock(redis as never, "k", 5000, async () => {
				throw new Error("boom");
			}),
		).rejects.toThrow("boom");
		expect(redis.keys.size).toBe(0);
	});
});

describe("createQueue", () => {
	it("opens the queue lazily and applies the default retry policy", async () => {
		const { Queue } = await import("bullmq");
		const redis = vi.fn(() => ({}) as never);
		const queue = createQueue({ name: "app-jobs", prefix: "p", redis });
		expect(Queue).not.toHaveBeenCalled();
		expect(await queue.enqueue("t", { a: 1 }, { attempts: 5 })).toBe("job-1");
		expect(Queue).toHaveBeenCalledWith("app-jobs", { connection: {}, prefix: "p" });
		expect(add).toHaveBeenCalledWith(
			"t",
			{ a: 1 },
			expect.objectContaining({ attempts: 5, removeOnFail: 5000 }),
		);
	});
});

describe("startCron", () => {
	it.each([
		["runs a schedule on its tick", false, 1],
		["skips the tick another process holds", true, 0],
	])("%s", async (_label, held, expected) => {
		vi.useFakeTimers();
		const redis = fakeRedis();
		if (held) redis.set = async () => null;
		let runs = 0;
		const jobs = startCron({
			schedules: [{ name: `s-${expected}`, cron: "* * * * * *", run: async () => void runs++ }],
			redis: redis as never,
			logger,
		});
		await vi.advanceTimersByTimeAsync(1000);
		for (const job of jobs) job.stop();
		vi.useRealTimers();
		expect(runs).toBe(expected);
		expect(redis.keys.size).toBe(0);
	});
});
