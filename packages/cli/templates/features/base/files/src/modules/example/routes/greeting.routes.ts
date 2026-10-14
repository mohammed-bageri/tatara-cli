import { createRoute } from "@hono/zod-openapi";
import { errorResponses, jsonContent, success, successSchema } from "#core/http/response";
import { createRouter, defineRoutes } from "#core/http/routes";
import { greet } from "#modules/example/services/greeting.service";
import {
	greetingQuerySchema,
	greetingSchema,
} from "#modules/example/validators/greeting.validators";

const router = createRouter();

router.openapi(
	createRoute({
		method: "get",
		path: "/",
		tags: ["Example"],
		summary: "Say hello",
		request: { query: greetingQuerySchema },
		responses: {
			200: jsonContent(successSchema(greetingSchema), "A greeting"),
			...errorResponses(400),
		},
	}),
	(c) => c.json(success(greet(c.req.valid("query").name)), 200),
);

export default defineRoutes({ app: "api", basePath: "/greetings", router });
