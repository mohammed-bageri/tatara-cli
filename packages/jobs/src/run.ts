import { type CoreLogger, onShutdown } from "@tatara/core";
import { Worker } from "bullmq";
import { Cron } from "croner";
import type { Redis } from "ioredis";
import { type ConsumerDefinition, processJob, type ScheduleDefinition } from "./define.ts";
import { withLock } from "./redis.ts";

export interface WorkerOptions {
	queue: string;
	prefix: string;
	redis: Redis;
	concurrency: number;
	consumers: ConsumerDefinition[];
	logger: CoreLogger;
}

/** Runs the consumers for jobs on the queue until shutdown. */
export function startWorker(options: WorkerOptions): Worker {
	const { consumers, logger } = options;
	const worker = new Worker(
		options.queue,
		(job) =>
			processJob(consumers, job.name, job.data, {
				logger: logger.child({ jobId: job.id, topic: job.name }),
				jobId: job.id ?? "",
				attempt: job.attemptsMade + 1,
			}),
		{ connection: options.redis, prefix: options.prefix, concurrency: options.concurrency },
	);
	worker.on("failed", (job, err) =>
		logger.error({ err, jobId: job?.id, topic: job?.name }, "job failed"),
	);
	onShutdown("worker", () => worker.close());
	logger.info({ topics: consumers.map((c) => c.topic) }, "worker started");
	return worker;
}

export interface CronOptions {
	schedules: ScheduleDefinition[];
	/** called on the first due tick, so starting cron opens no connection */
	redis: () => Pick<Redis, "set" | "eval">;
	logger: CoreLogger;
}

/** Runs each schedule in UTC; a lock per tick means one run across all cron processes. */
export function startCron({ schedules, redis, logger }: CronOptions): Cron[] {
	const jobs = schedules.map((schedule) => {
		const log = logger.child({ schedule: schedule.name });
		return new Cron(
			schedule.cron,
			{ timezone: "UTC", protect: true, name: schedule.name },
			async (self: Cron) => {
				const tick = self.currentRun()?.toISOString() ?? new Date().toISOString();
				const ran = await withLock(
					redis(),
					`schedule:${schedule.name}:${tick}`,
					schedule.lockTtlMs ?? 60_000,
					() => schedule.run({ logger: log }),
				).catch((error: unknown) => {
					log.error({ err: error }, "schedule failed");
					return true;
				});
				if (!ran) log.debug("skipped: another process holds this tick");
			},
		);
	});
	onShutdown("cron", () => {
		for (const job of jobs) job.stop();
	});
	logger.info({ schedules: schedules.map((s) => `${s.name} (${s.cron})`) }, "cron started");
	return jobs;
}
