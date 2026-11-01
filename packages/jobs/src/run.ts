import { type CoreLogger, onShutdown } from "@tatara/core";
import type { ConsumerDefinition } from "./define.ts";
import type { JobDriver } from "./driver.ts";
import { jobHandler } from "./runner.ts";

export interface WorkerOptions {
	driver: JobDriver;
	consumers: readonly ConsumerDefinition[];
	concurrency: number;
	logger: CoreLogger;
}

/** Runs the consumers for jobs from the driver until shutdown. */
export async function startWorker(options: WorkerOptions): Promise<() => Promise<void>> {
	const { driver, consumers, logger } = options;
	const stop = await driver.consume(jobHandler(consumers, logger), {
		concurrency: options.concurrency,
		logger,
	});
	onShutdown("worker", stop);
	logger.info({ driver: driver.name, topics: consumers.map((c) => c.topic) }, "worker started");
	return stop;
}
