import { authorizationRoutes } from "@tatara/authz";
import { authz } from "#core/authz/index";
import type { AppEnv } from "#core/http/context";
import { defineRoutes } from "#core/http/routes";

export default defineRoutes({
	app: "api",
	basePath: "/authorization",
	router: authorizationRoutes<AppEnv>(authz),
});
