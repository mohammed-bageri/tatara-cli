import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "#core/http/context";
import { validationHook } from "#core/http/middleware/validation";

export const APP_NAMES = [
	"api",
	// tatara:slot app-names
] as const;

export type AppName = (typeof APP_NAMES)[number];

export interface RouteDefinition {
	/** which HTTP app serves these routes */
	app: AppName;
	/** mounted under `/api` + basePath, e.g. "/notes" */
	basePath: string;
	router: OpenAPIHono<AppEnv>;
}

/** Default export of every `routes/*.routes.ts`; discovered by `tatara sync`. */
export function defineRoutes(definition: RouteDefinition): RouteDefinition {
	return definition;
}

/** A router for one routes file. Attach middleware per route or per path, never `use("*")`. */
export function createRouter(): OpenAPIHono<AppEnv> {
	return new OpenAPIHono<AppEnv>({ defaultHook: validationHook });
}
