import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { RequestTimeoutError } from "./errors.ts";

export interface TimeoutOptions {
	defaultMs: number;
	/** longer (or shorter) limits by path: "/api/uploads/*" matches everything under it */
	paths?: Record<string, number>;
}

function limitFor(path: string, options: TimeoutOptions): number {
	let best: { length: number; ms: number } | undefined;
	for (const [pattern, ms] of Object.entries(options.paths ?? {})) {
		const prefix = pattern.endsWith("/*") ? pattern.slice(0, -1) : undefined;
		const matches = prefix ? path.startsWith(prefix) || `${path}/` === prefix : path === pattern;
		// the most specific pattern wins
		if (matches && (!best || pattern.length > best.length)) best = { length: pattern.length, ms };
	}
	return best?.ms ?? options.defaultMs;
}

/** Answers 504 REQUEST_TIMEOUT when a handler takes longer than its path's limit. */
export function requestTimeout(options: TimeoutOptions): MiddlewareHandler {
	return createMiddleware(async (c, next) => {
		const ms = limitFor(c.req.path, options);
		let timer: ReturnType<typeof setTimeout> | undefined;
		const expired = new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new RequestTimeoutError()), ms);
		});
		try {
			await Promise.race([next(), expired]);
		} finally {
			clearTimeout(timer);
		}
	});
}
