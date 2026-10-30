import {
	createRouter as createTataraRouter,
	type RouteDefinition as TataraRouteDefinition,
} from "@tatara/http";
import type { AppEnv } from "#core/http/context";

export const APP_NAMES = [
	"api",
	// tatara:slot app-names
] as const;

export type AppName = (typeof APP_NAMES)[number];

export type RouteDefinition = TataraRouteDefinition<AppName, AppEnv>;

/** Default export of every `routes/*.routes.ts`; discovered by `tatara sync`. */
export function defineRoutes(definition: RouteDefinition): RouteDefinition {
	return definition;
}

/** A router for one routes file. Attach middleware per route or per path, never `use("*")`. */
export function createRouter() {
	return createTataraRouter<AppEnv>();
}
