import { describe, expect, it } from "vitest";
import { processJob } from "#core/jobs/process";
import { logger } from "#core/logging/logger";
import { consumers } from "#generated/consumers";

describe("__moduleKebab__.__nameKebab__", () => {
	it("handles a valid payload", async () => {
		await expect(
			processJob(consumers, "__moduleKebab__.__nameKebab__", { id: "1" }, { logger, jobId: "t", attempt: 1 }),
		).resolves.toBeUndefined();
	});
});
