import { createRoute } from "@hono/zod-openapi";
import { jsonContent, success, successSchema } from "#core/http/response";
import { createRouter, defineRoutes } from "#core/http/routes";
import { __moduleCamel__Status } from "#modules/__moduleKebab__/services/__moduleKebab__.service";
import { __moduleCamel__StatusSchema } from "#modules/__moduleKebab__/validators/__moduleKebab__.validators";

const router = createRouter();

router.openapi(
	createRoute({
		method: "get",
		path: "/status",
		tags: ["__modulePascal__"],
		summary: "__moduleTitle__ module status",
		responses: { 200: jsonContent(successSchema(__moduleCamel__StatusSchema), "Status") },
	}),
	(c) => c.json(success(__moduleCamel__Status()), 200),
);

export default defineRoutes({ app: "api", basePath: "/__moduleKebab__", router });
