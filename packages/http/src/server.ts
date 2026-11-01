import { type ServerType, serve } from "@hono/node-server";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { type CoreLogger, handleSignals, onShutdown } from "@tatara/core";
import type { HttpEnv } from "./app.ts";

/** Starts an HTTP app; on shutdown stops accepting connections and drains in-flight requests. */
export function startServer<E extends HttpEnv>(
	app: OpenAPIHono<E>,
	options: {
		port: number;
		name: string;
		logger: CoreLogger;
		/** runs once the server exists, e.g. to attach a websocket server to it */
		onServer?: (server: ServerType) => void;
	},
) {
	const { port, name, logger } = options;
	const server = serve({ fetch: app.fetch, port }, (info) => {
		logger.info(
			{ port: info.port, app: name },
			`${name} listening on http://localhost:${info.port}`,
		);
	});
	options.onServer?.(server);
	onShutdown(`${name}-http`, () => new Promise<void>((resolve) => server.close(() => resolve())));
	handleSignals(logger);
	return server;
}
