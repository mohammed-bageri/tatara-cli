import { describe, expect, it } from "vitest";
import { greet } from "#modules/example/services/greeting.service";
import { api } from "#tests/helpers/api";

describe("greetings", () => {
	it("greets by name", () => {
		expect(greet("Ada")).toEqual({ message: "Hello, Ada!" });
	});

	it("serves GET /api/greetings", async () => {
		const res = await api.get("/api/greetings?name=Ada");
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ success: true, data: { message: "Hello, Ada!" } });
	});

	it("rejects an invalid query with the error envelope", async () => {
		const res = await api.get(`/api/greetings?name=${"x".repeat(60)}`);
		expect(res.status).toBe(400);
		expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
	});
});
