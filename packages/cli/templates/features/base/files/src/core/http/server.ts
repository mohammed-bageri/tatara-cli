import { serve } from "@hono/node-server";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "#core/http/context";
import { logger } from "#core/logging/logger";
import { handleSignals, onShutdown } from "#core/process/lifecycle";

/** Starts an HTTP app; on shutdown stops accepting connections and drains in-flight requests. */
export function startServer(app: OpenAPIHono<AppEnv>, port: number, name: string) {
	const server = serve({ fetch: app.fetch, port }, (info) => {
		logger.info({ port: info.port, app: name }, `${name} listening on http://localhost:${info.port}`);
	});
	onShutdown(`${name}-http`, () => new Promise<void>((resolve) => server.close(() => resolve())));
	handleSignals();
	return server;
}
