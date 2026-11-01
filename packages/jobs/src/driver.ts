import type { CoreLogger } from "@tatara/core";
import type { JobEnvelope } from "./define.ts";
import type { JobHandler } from "./runner.ts";

export interface Outgoing {
	job: JobEnvelope;
	/** how long before the job may run (0: now) */
	delayMs: number;
}

/** Where jobs wait and how they reach a worker. Retries and dead letters come back through `handle`. */
export interface JobDriver {
	readonly name: string;
	/**
	 * Stores jobs. `executor` is the caller's transaction, for drivers that can write in it (Postgres):
	 * the job then exists exactly when the caller's own writes commit.
	 */
	send(jobs: Outgoing[], executor?: unknown): Promise<void>;
	/** Delivers jobs to `handle` until the returned function stops it (in-flight jobs finish first). */
	consume(
		handle: JobHandler,
		options: { concurrency: number; logger: CoreLogger },
	): Promise<() => Promise<void>>;
}
