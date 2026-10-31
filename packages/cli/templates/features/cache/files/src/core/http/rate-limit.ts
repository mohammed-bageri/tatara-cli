import { clientIp, type RateLimitOptions, rateLimit } from "@tatara/http";
import { cache } from "#core/cache/index";
import { env } from "#core/config/env";

/**
 * `middleware: [limitRequests({ name: "contact", windowMs: 60_000, max: 5 })]` on a route: per
 * caller IP, or per whatever `key` returns (e.g. the signed-in user).
 */
export function limitRequests(options: Omit<RateLimitOptions, "counter" | "key"> & Partial<Pick<RateLimitOptions, "key">>) {
	return rateLimit({
		counter: cache,
		key: (c) => clientIp(c, { trustedHops: env.TRUSTED_PROXY_HOPS }),
		...options,
	});
}
