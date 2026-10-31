import { describe, expect, it } from "vitest";
import { processJob, withLock } from "@tatara/jobs";
import { redis } from "#core/jobs/index";
import { logger } from "#core/logging/logger";
import { consumers } from "#generated/consumers";

const ctx = { logger, jobId: "test", attempt: 1 };

describe("jobs", () => {
	it("runs the consumer for a topic with a valid payload", async () => {
		await expect(processJob(consumers, "example.send-welcome", { name: "Ada" }, ctx)).resolves.toBeUndefined();
	});

	it("rejects an invalid payload", async () => {
		await expect(processJob(consumers, "example.send-welcome", { name: "" }, ctx)).rejects.toThrow(
			/Invalid payload/,
		);
	});

	it("lets only one holder run a locked section", async () => {
		const key = `test-${Date.now()}-${Math.random()}`;
		let inner: boolean | undefined;
		const outer = await withLock(redis(), key, 5000, async () => {
			inner = await withLock(redis(), key, 5000, async () => {});
		});
		expect(outer).toBe(true);
		expect(inner).toBe(false);
	});
});
