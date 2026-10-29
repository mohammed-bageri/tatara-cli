import { expect, it } from "vitest";
import { adminApi } from "#tests/helpers/api";

it("leaves auth out of the admin OpenAPI document", async () => {
	const res = await adminApi.get<{ paths: Record<string, unknown> }>("/openapi.json");
	expect(res.status).toBe(200);
	expect(Object.keys(res.body.paths).some((path) => path.startsWith("/api/auth/"))).toBe(false);
});
