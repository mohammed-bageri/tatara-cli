import { createRoute } from "@hono/zod-openapi";
import { createRouter, handleErrors } from "@tatara/http";
import { describe, expect, it } from "vitest";
import { limitRequests } from "#core/http/rate-limit";

describe("limitRequests", () => {
	it("answers 429 once a caller passes the limit", async () => {
		const name = crypto.randomUUID();
		const app = createRouter();
		app.openapi(
			createRoute({
				method: "post",
				path: "/contact",
				middleware: [limitRequests({ name, windowMs: 60_000, max: 2, key: (c) => c.req.header("x-who") })],
				responses: { 204: { description: "Sent" } },
			}),
			(c) => c.body(null, 204),
		);
		handleErrors(app);
		const send = () => app.request("/contact", { method: "POST", headers: { "x-who": "a" } });
		expect((await send()).status).toBe(204);
		expect((await send()).status).toBe(204);
		const limited = await send();
		expect(limited.status).toBe(429);
		expect(limited.headers.get("retry-after")).toBe("60");
	});
});
