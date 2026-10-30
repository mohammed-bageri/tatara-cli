import { createRoute, z } from "@hono/zod-openapi";
import type { CoreLogger } from "@tatara/core";
import { createRouter } from "@tatara/http";
import { expectTypeOf, it } from "vitest";
import { type Principal, requireAuth, requireRole } from "./index.ts";

interface AppEnv {
	Variables: {
		requestId: string;
		logger: CoreLogger;
		principal: Principal | null;
		language: string;
	};
}

it("keeps the app's context types behind one guard", () => {
	const router = createRouter<AppEnv>();
	router.openapi(
		createRoute({
			method: "get",
			path: "/",
			middleware: [requireAuth()] as const,
			responses: {
				200: { description: "ok", content: { "application/json": { schema: z.object({}) } } },
			},
		}),
		(c) => {
			expectTypeOf(c.get("principal")).toEqualTypeOf<Principal | null>();
			expectTypeOf(c.get("requestId")).toEqualTypeOf<string>();
			// @ts-expect-error unknown variables stay errors
			c.get("nope");
			return c.json({}, 200);
		},
	);
});

it("keeps the app's context types behind a role guard", () => {
	const router = createRouter<AppEnv>();
	router.openapi(
		createRoute({
			method: "get",
			path: "/",
			middleware: [requireRole("admin")] as const,
			responses: {
				200: { description: "ok", content: { "application/json": { schema: z.object({}) } } },
			},
		}),
		(c) => {
			expectTypeOf(c.get("principal")).toEqualTypeOf<Principal | null>();
			expectTypeOf(c.get("requestId")).toEqualTypeOf<string>();
			// @ts-expect-error unknown variables stay errors
			c.get("nope");
			return c.json({}, 200);
		},
	);
});

it("keeps the app's context types behind two guards", () => {
	const router = createRouter<AppEnv>();
	router.openapi(
		createRoute({
			method: "get",
			path: "/",
			middleware: [requireAuth(), requireRole("admin")] as const,
			responses: {
				200: { description: "ok", content: { "application/json": { schema: z.object({}) } } },
			},
		}),
		(c) => {
			expectTypeOf(c.get("principal")).toEqualTypeOf<Principal | null>();
			expectTypeOf(c.get("requestId")).toEqualTypeOf<string>();
			// @ts-expect-error unknown variables stay errors
			c.get("nope");
			return c.json({}, 200);
		},
	);
});

it("guards mount with app.use on the app's own env", () => {
	const router = createRouter<AppEnv>();
	router.use("/admin/*", requireRole("admin"));
	router.get("/admin/x", (c) => {
		expectTypeOf(c.get("requestId")).toEqualTypeOf<string>();
		return c.json({});
	});
});
