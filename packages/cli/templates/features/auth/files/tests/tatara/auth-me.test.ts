import { beforeEach, describe, expect, it } from "vitest";
import { api } from "#tests/helpers/api";
import { asUser } from "#tests/helpers/auth";
import { resetDatabase } from "#tests/helpers/db";

beforeEach(async () => {
	await resetDatabase();
});

describe("GET /api/me", () => {
	it("returns 401 without credentials", async () => {
		const res = await api.get("/api/me");
		expect(res.status).toBe(401);
		expect(res.body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
	});

	it("returns the principal for an authenticated user", async () => {
		const res = await api.get<{ data: { userId: string; kind: string } }>("/api/me", {
			headers: await asUser(),
		});
		expect(res.status).toBe(200);
		expect(res.body.data.kind).toBe("user");
		expect(res.body.data.userId).toBeTruthy();
	});
});
