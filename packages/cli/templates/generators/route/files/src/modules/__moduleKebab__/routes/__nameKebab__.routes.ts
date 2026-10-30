import { createRoute } from "@hono/zod-openapi";
import { errorResponses, jsonContent, success, successSchema } from "@tatara/http";
import { createRouter, defineRoutes } from "#core/http/routes";
// tatara:slot imports
import {
	__nameCamel__QuerySchema,
	__nameCamel__ResponseSchema,
} from "#modules/__moduleKebab__/validators/__nameKebab__.validators";

const router = createRouter();

router.openapi(
	createRoute({
		method: "get",
		path: "/",
		tags: ["__modulePascal__"],
		summary: "__nameTitle__",
		// tatara:slot guard-read
		request: { query: __nameCamel__QuerySchema },
		responses: {
			200: jsonContent(successSchema(__nameCamel__ResponseSchema), "__nameTitle__"),
			...errorResponses(400),
			// tatara:slot auth-errors
		},
	}),
	(c) => c.json(success({ message: `__nameKebab__: ${c.req.valid("query").q ?? "ok"}` }), 200),
);

export default defineRoutes({ app: "api", basePath: "/__nameKebab__", router });
