import { Redis } from "ioredis";
import { env } from "#core/config/env";
import { onShutdown } from "@tatara/core";

let client: Redis | undefined;

/** Shared connection (BullMQ requires maxRetriesPerRequest: null). */
export function redis(): Redis {
	if (!client) {
		const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
		client = connection;
		onShutdown("redis", async () => {
			await connection.quit();
		});
	}
	return client;
}
