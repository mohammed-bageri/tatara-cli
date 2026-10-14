import { describe, expect, it } from "vitest";
import { api } from "#tests/helpers/api";

describe("__moduleKebab__", () => {
	it("reports status", async () => {
		const res = await api.get("/api/__moduleKebab__/status");
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ success: true, data: { module: "__moduleKebab__", status: "ok" } });
	});
});
