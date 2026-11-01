import { onShutdown } from "@tatara/core";
import { type Cache, createCache, type CacheStore, memoryStore } from "@tatara/cache";
import { postgresStore } from "@tatara/cache/postgres";
import { redisStore } from "@tatara/cache/redis";
import { Redis } from "ioredis";
import pg from "pg";
import { env } from "#core/config/env";
import { logger } from "#core/logging/logger";

export type { Cache } from "@tatara/cache";

function redis(): CacheStore {
	// connects on first command, so importing this file opens nothing
	const client = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });
	onShutdown("cache", async () => {
		await client.quit();
	});
	return redisStore(client);
}

function postgres(): CacheStore {
	// an unlogged table in the "tatara" schema, created on first use
	const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 5 });
	onShutdown("cache", async () => {
		await pool.end();
	});
	return postgresStore(pool);
}

const stores = { redis, postgres, memory: memoryStore };

/** The app's cache; pick the store with CACHE_DRIVER. */
export const cache: Cache = createCache(stores[env.CACHE_DRIVER](), {
	prefix: "__APP_NAME__",
	onError: (error, key) => logger.warn({ err: error, key }, "cache unavailable, computing instead"),
});
