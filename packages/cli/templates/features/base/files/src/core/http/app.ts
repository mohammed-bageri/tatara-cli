import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { env } from "#core/config/env";
import type { AppEnv } from "#core/http/context";
import { runReadinessChecks } from "#core/http/health";
import { errorHandler, notFoundHandler } from "#core/http/middleware/error-handler";
import { requestContext } from "#core/http/middleware/request-context";
import { validationHook } from "#core/http/middleware/validation";
import type { AppName } from "#core/http/routes";
import { routes } from "#generated/routes";
// tatara:slot imports

export const API_PREFIX = "/api";

export function createHttpApp(name: AppName, options: { title: string }) {
	const app = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

	app.use(requestContext);
	app.use(secureHeaders());
	app.use(
		cors({
			origin: env.CORS_ORIGINS,
			credentials: true,
			allowHeaders: ["Content-Type", "Authorization", "X-Request-Id", "Accept-Language"],
			exposeHeaders: ["X-Request-Id"],
		}),
	);
	app.use(bodyLimit({ maxSize: env.BODY_LIMIT_BYTES }));
	// tatara:slot middleware

	app.get("/health", (c) => c.json({ status: "ok" }));
	app.get("/ready", async (c) => {
		const result = await runReadinessChecks();
		return c.json(result, result.ready ? 200 : 503);
	});

	// tatara:slot routes

	for (const definition of routes) {
		if (definition.app === name) app.route(`${API_PREFIX}${definition.basePath}`, definition.router);
	}

	app.doc31("/openapi.json", { openapi: "3.1.0", info: { title: options.title, version: "1.0.0" } });
	app.get("/docs", Scalar({ url: "/openapi.json", pageTitle: options.title }));

	app.onError(errorHandler);
	app.notFound(notFoundHandler);
	return app;
}
