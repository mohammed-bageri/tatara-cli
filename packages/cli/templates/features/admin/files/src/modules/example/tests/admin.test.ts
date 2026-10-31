import { describe, expect, it } from "vitest";
import { adminApi } from "#tests/helpers/api";
import { asUser } from "#tests/helpers/auth";
import { asStaff } from "#tests/helpers/staff";

describe("admin app", () => {
	it("requires authentication", async () => {
		const res = await adminApi.get("/api/greetings");
		expect(res.status).toBe(401);
	});

	it("refuses users: the admin app is for staff", async () => {
		const res = await adminApi.get("/api/greetings", { headers: await asUser({ roles: ["admin"] }) });
		// a users session isn't known here (401); a Keycloak token without the staff role is (403)
		expect([401, 403]).toContain(res.status);
	});

	it("forbids staff without the staff role", async () => {
		const res = await adminApi.get("/api/greetings", { headers: await asStaff({ role: "intern" }) });
		expect(res.status).toBe(403);
	});

	it("serves staff", async () => {
		const res = await adminApi.get("/api/greetings", { headers: await asStaff() });
		expect(res.status).toBe(200);
	});
});
