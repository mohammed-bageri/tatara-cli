import { randomUUID } from "node:crypto";
import { onShutdown } from "@tatara/core";
import { Redis } from "ioredis";

/** A shared connection, opened on first call and closed on shutdown (BullMQ needs maxRetriesPerRequest: null). */
export function lazyRedis(url: string): () => Redis {
	let client: Redis | undefined;
	return () => {
		if (!client) {
			const connection = new Redis(url, { maxRetriesPerRequest: null });
			client = connection;
			onShutdown("redis", async () => {
				await connection.quit();
			});
		}
		return client;
	};
}

const RELEASE = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

type LockClient = Pick<Redis, "set" | "eval">;

/** Runs `fn` only if this process wins the lock; returns false when another holder has it. */
export async function withLock(
	redis: LockClient,
	key: string,
	ttlMs: number,
	fn: () => Promise<void>,
): Promise<boolean> {
	const token = randomUUID();
	const acquired = await redis.set(`lock:${key}`, token, "PX", ttlMs, "NX");
	if (acquired !== "OK") return false;
	try {
		await fn();
	} finally {
		await redis.eval(RELEASE, 1, `lock:${key}`, token);
	}
	return true;
}
