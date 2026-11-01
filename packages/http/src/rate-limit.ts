import type { CoreLogger } from "@tatara/core";
import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { TooManyRequestsError } from "./errors.ts";

/** What a rate limit counts with; `cache` from `@tatara/cache` is one. */
export interface RateLimitCounter {
	increment(key: string, options: { ttlMs: number }): Promise<number>;
}

export interface RateLimitOptions {
	counter: RateLimitCounter;
	/** names the limit in its keys, e.g. "sign-in" */
	name: string;
	/** who is counted: an IP, a user id; null skips the limit for this request */
	key: (c: Context) => string | null | undefined | Promise<string | null | undefined>;
	windowMs: number;
	max: number;
}

/**
 * A fixed-window limit: `max` requests per `windowMs` per key, then 429 with Retry-After.
 * A failing counter lets the request through (and logs it) rather than taking the API down.
 */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
	if (!(options.max > 0 && options.windowMs > 0))
		throw new Error("rateLimit needs a positive max and windowMs");
	const retryAfter = Math.ceil(options.windowMs / 1000);
	return createMiddleware(async (c, next) => {
		const who = await options.key(c);
		if (who) {
			let count: number | undefined;
			try {
				count = await options.counter.increment(`rate:${options.name}:${who}`, {
					ttlMs: options.windowMs,
				});
			} catch (err) {
				(c.get("logger") as CoreLogger | undefined)?.warn(
					{ err, limit: options.name },
					"rate limit counter unavailable, allowing the request",
				);
			}
			if (count !== undefined) {
				c.header("RateLimit-Limit", String(options.max));
				c.header("RateLimit-Remaining", String(Math.max(0, options.max - count)));
				if (count > options.max) throw new TooManyRequestsError(retryAfter);
			}
		}
		await next();
	});
}
