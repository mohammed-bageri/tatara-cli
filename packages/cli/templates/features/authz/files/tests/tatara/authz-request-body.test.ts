import { beforeEach, describe, expect, it } from "vitest";
import { app } from "#apps/api/app";
import { asUser } from "#tests/helpers/auth";
import { resetDatabase } from "#tests/helpers/db";

beforeEach(async () => {
	await resetDatabase();
});

// A body sent without Content-Type used to skip validation and reach services as {}
describe("JSON request bodies", () => {
	it("rejects a missing body with 400", async () => {
		const headers = await asUser({ systemRoles: ["admin"] });
		const res = await app.request("/api/authorization/roles", { method: "POST", headers });
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ code: "VALIDATION_ERROR" });
	});

	it("does not assign a role from a missing body", async () => {
		const headers = await asUser({ systemRoles: ["admin"] });
		const res = await app.request("/api/authorization/members/someone/roles", {
			method: "POST",
			headers,
		});
		expect(res.status).toBe(400);
	});
});
