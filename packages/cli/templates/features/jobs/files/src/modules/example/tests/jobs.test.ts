import { describe, expect, it } from "vitest";
import { type InlineDriver, processJob } from "@tatara/jobs";
import { enqueue, jobs } from "#core/jobs/index";
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

	it("runs an enqueued job in tests (JOBS_DRIVER=inline)", async () => {
		await enqueue("example.send-welcome", { name: "Ada" });
		const driver = jobs.driver as InlineDriver;
		await driver.drain();
		expect(driver.dead).toEqual([]);
	});
});
