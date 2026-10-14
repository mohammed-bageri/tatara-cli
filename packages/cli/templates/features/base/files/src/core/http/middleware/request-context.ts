import { createMiddleware } from "hono/factory";
import type { AppEnv } from "#core/http/context";
import { logger } from "#core/logging/logger";

const REQUEST_ID = /^[\w-]{8,128}$/;

/** Sets requestId, a request-scoped logger and defaults; logs one line per request. */
export const requestContext = createMiddleware<AppEnv>(async (c, next) => {
	const incoming = c.req.header("x-request-id");
	const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
	const log = logger.child({ requestId });
	c.set("requestId", requestId);
	c.set("logger", log);
	c.set("principal", null);
	c.set("language", "en");
	c.header("x-request-id", requestId);
	const start = performance.now();
	await next();
	const ms = Math.round(performance.now() - start);
	const status = c.res.status;
	const entry = { method: c.req.method, path: c.req.path, status, ms };
	if (status >= 500) log.error(entry, "request failed");
	else log.info(entry, "request");
});
