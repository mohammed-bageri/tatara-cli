import { createRoute, z } from "@hono/zod-openapi";
import { currentPrincipal, requireAuth } from "@tatara/auth";
import { errorResponses, jsonContent, success, successSchema } from "@tatara/http";
import { createRouter, defineRoutes } from "#core/http/routes";

const principalSchema = z
	.object({
		userId: z.string(),
		orgId: z.string().nullable(),
		roles: z.array(z.string()),
		kind: z.enum(["user", "service"]),
	})
	.openapi("Principal");

const router = createRouter();

router.openapi(
	createRoute({
		method: "get",
		path: "/",
		tags: ["Auth"],
		summary: "The authenticated principal",
		middleware: [requireAuth()] as const,
		security: [{ bearerAuth: [] }],
		responses: {
			200: jsonContent(successSchema(principalSchema), "Who is calling"),
			...errorResponses(401),
		},
	}),
	(c) => {
		const { userId, orgId, roles, kind } = currentPrincipal(c);
		return c.json(success({ userId, orgId, roles, kind }), 200);
	},
);

export default defineRoutes({ app: "api", basePath: "/me", router });
