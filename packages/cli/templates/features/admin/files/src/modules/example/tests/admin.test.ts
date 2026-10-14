import { describe, expect, it } from "vitest";
import { adminApi } from "#tests/helpers/api";
import { asUser } from "#tests/helpers/auth";

describe("admin app", () => {
	it("requires authentication", async () => {
		const res = await adminApi.get("/api/greetings");
		expect(res.status).toBe(401);
	});

	it("forbids users without the admin role", async () => {
		const res = await adminApi.get("/api/greetings", { headers: await asUser() });
		expect(res.status).toBe(403);
	});

	it("serves admins", async () => {
		const res = await adminApi.get("/api/greetings", { headers: await asUser({ roles: ["admin"] }) });
		expect(res.status).toBe(200);
	});
});
