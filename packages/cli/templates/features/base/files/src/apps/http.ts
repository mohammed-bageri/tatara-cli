import { createApp, handleErrors, mountRoutes, serveOpenApi } from "@tatara/http";
import { env } from "#core/config/env";
import type { AppEnv } from "#core/http/context";
import type { AppName } from "#core/http/routes";
import { logger } from "#core/logging/logger";
import { routes } from "#generated/routes";
// tatara:slot imports

export const API_PREFIX = "/api";

/** The app's HTTP wiring: plain Hono, with tatara's defaults from @tatara/http. */
export function createHttpApp(name: AppName, options: { title: string }) {
	const app = createApp<AppEnv>({
		logger,
		cors: {
			origins: env.CORS_ORIGINS,
			exposeHeaders: [
				"X-Request-Id",
				// tatara:slot expose-headers
			],
		},
		bodyLimitBytes: env.BODY_LIMIT_BYTES,
		timeouts: {
			defaultMs: env.REQUEST_TIMEOUT_MS,
			paths: {
				// tatara:slot timeout-paths
			},
		},
		defaults: { principal: null, language: "en" },
	});
	// tatara:slot middleware

	// tatara:slot routes

	mountRoutes(app, routes, { app: name, prefix: API_PREFIX });
	serveOpenApi(app, {
		title: options.title,
		// tatara:slot openapi-options
	});
	handleErrors(app, {
		// tatara:slot error-options
	});
	return app;
}
