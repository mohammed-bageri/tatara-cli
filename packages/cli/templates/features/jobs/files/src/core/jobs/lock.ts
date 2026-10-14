import { randomUUID } from "node:crypto";
import { redis } from "#core/jobs/redis";

const RELEASE = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

/** Runs `fn` only if this process wins the lock; returns false when another holder has it. */
export async function withLock(key: string, ttlMs: number, fn: () => Promise<void>): Promise<boolean> {
	const token = randomUUID();
	const acquired = await redis().set(`lock:${key}`, token, "PX", ttlMs, "NX");
	if (acquired !== "OK") return false;
	try {
		await fn();
	} finally {
		await redis().eval(RELEASE, 1, `lock:${key}`, token);
	}
	return true;
}
