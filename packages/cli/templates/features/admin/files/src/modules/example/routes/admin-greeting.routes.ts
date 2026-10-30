import { createRoute } from "@hono/zod-openapi";
import { currentPrincipal } from "@tatara/auth";
import { errorResponses, jsonContent, success, successSchema } from "@tatara/http";
import { createRouter, defineRoutes } from "#core/http/routes";
import { greetingSchema } from "#modules/example/validators/greeting.validators";

const router = createRouter();

router.openapi(
	createRoute({
		method: "get",
		path: "/",
		tags: ["Example"],
		summary: "Greet the signed-in admin",
		security: [{ bearerAuth: ["admin"] }],
		responses: {
			200: jsonContent(successSchema(greetingSchema), "A greeting"),
			...errorResponses(401, 403),
		},
	}),
	(c) => c.json(success({ message: `Hello, admin ${currentPrincipal(c).userId}!` }), 200),
);

export default defineRoutes({ app: "admin", basePath: "/greetings", router });
