import { expect, it } from "vitest";
import { adminApi } from "#tests/helpers/api";

it("documents the staff auth on the admin app, not the users' sign-up", async () => {
	const res = await adminApi.get<{ paths: Record<string, unknown> }>("/openapi.json");
	expect(res.status).toBe(200);
	const paths = Object.keys(res.body.paths);
	expect(paths).toContain("/api/auth/sign-in/email");
	expect(paths.some((path) => path.startsWith("/api/auth/sign-in/anonymous"))).toBe(false);
});
