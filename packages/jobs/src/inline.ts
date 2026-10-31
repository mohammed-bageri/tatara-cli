import type { CoreLogger } from "@tatara/core";
import type { ConsumerDefinition, JobEnvelope } from "./define.ts";
import type { JobDriver } from "./driver.ts";
import { type JobHandler, jobHandler } from "./runner.ts";

export interface InlineDriver extends JobDriver {
	/** resolves once every job sent so far, and every retry, has finished */
	drain(): Promise<void>;
	/** jobs that ended dead, newest last */
	readonly dead: JobEnvelope[];
}

/**
 * Runs jobs in this process, right after they're sent: for tests and for development without a
 * worker. Nothing survives a restart. `retryDelay` lets tests skip the backoff.
 */
export function inlineDriver(options: {
	/** or a function that loads them on first send, so the producer needn't import them */
	consumers: readonly ConsumerDefinition[] | (() => Promise<readonly ConsumerDefinition[]>);
	logger: CoreLogger;
	retryDelay?: (delayMs: number) => number;
}): InlineDriver {
	let handler: Promise<JobHandler> | undefined;
	const handle = async (job: JobEnvelope) => {
		const { consumers } = options;
		handler ??= (async () =>
			jobHandler(
				typeof consumers === "function" ? await consumers() : consumers,
				options.logger,
			))();
		return (await handler)(job);
	};
	const pending = new Set<Promise<void>>();
	const dead: JobEnvelope[] = [];

	const schedule = (job: JobEnvelope, delayMs: number) => {
		const run = new Promise<void>((resolve) => {
			setTimeout(async () => {
				const outcome = await handle(job);
				if (outcome.status === "retry")
					schedule(
						{ ...job, attempt: job.attempt + 1 },
						options.retryDelay ? options.retryDelay(outcome.delayMs) : outcome.delayMs,
					);
				if (outcome.status === "dead") dead.push(job);
				resolve();
			}, delayMs);
		});
		pending.add(run);
		void run.then(() => pending.delete(run));
	};

	return {
		name: "inline",
		dead,
		async send(jobs) {
			for (const { job, delayMs } of jobs) schedule(job, delayMs);
		},
		async consume() {
			// jobs already run where they're sent
			return async () => {};
		},
		async drain() {
			while (pending.size > 0) await Promise.all([...pending]);
		},
	};
}
