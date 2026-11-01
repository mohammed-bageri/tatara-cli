import { createRoute, z } from "@hono/zod-openapi";
import { currentPrincipal, requireAuth } from "@tatara/auth";
import { errorResponses, jsonContent, success, successSchema } from "@tatara/http";
import { env } from "#core/config/env";
import { createRouter, defineRoutes } from "#core/http/routes";
import { realtime } from "#core/realtime/index";
// tatara:slot imports

const router = createRouter();

router.openapi(
	createRoute({
		method: "post",
		path: "/ticket",
		tags: ["Realtime"],
		summary: "A single-use ticket to open a websocket as the caller",
		middleware: [
			requireAuth(),
			// tatara:slot guard
		],
		security: [{ bearerAuth: [] }],
		responses: {
			200: jsonContent(
				successSchema(z.object({ ticket: z.string(), expiresInMs: z.number().int(), path: z.string() })),
				"Connect with io(url, { path, auth: { ticket } })",
			),
			...errorResponses(401),
		},
	}),
	async (c) => {
		const principal = currentPrincipal(c);
		// apps without organizations have one, "default"
		const ticket = await realtime.issueTicket({ userId: principal.userId, orgId: principal.orgId ?? "default" });
		return c.json(success({ ...ticket, path: env.REALTIME_PATH }), 200);
	},
);

export default defineRoutes({ app: "api", basePath: "/realtime", router });
