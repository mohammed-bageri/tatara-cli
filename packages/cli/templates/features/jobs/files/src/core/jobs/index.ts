import { createQueue, lazyRedis } from "@tatara/jobs";
import { env } from "#core/config/env";

export const QUEUE_NAME = "__APP_NAME__-jobs";

/** The shared Redis connection, opened on first use. */
export const redis = lazyRedis(env.REDIS_URL);

/** `enqueue(topic, data)`: the consumer with that topic validates the payload. */
export const { enqueue } = createQueue({ name: QUEUE_NAME, prefix: env.JOBS_PREFIX, redis });
