import { beforeEach, describe, expect, it } from "vitest";
import { api } from "#tests/helpers/api";
import { resetDatabase } from "#tests/helpers/db";
// tatara:slot test-imports

const path = "/api/__namePluralKebab__";
const headers: Record<string, string> = {};

interface __namePascal__Body {
	data: { id: string; name: string; description: string | null };
}

beforeEach(async () => {
	await resetDatabase();
	// tatara:slot test-auth
});

describe("__namePluralKebab__", () => {
	it("creates, reads, updates, lists and deletes", async () => {
		const created = await api.post<__namePascal__Body>(path, { name: "First" }, { headers });
		expect(created.status).toBe(201);
		const { id } = created.body.data;
		expect(created.body.data).toMatchObject({ name: "First", description: null });

		const read = await api.get<__namePascal__Body>(`${path}/${id}`, { headers });
		expect(read.status).toBe(200);
		expect(read.body.data.id).toBe(id);

		const updated = await api.patch<__namePascal__Body>(
			`${path}/${id}`,
			{ description: "Changed" },
			{ headers },
		);
		expect(updated.status).toBe(200);
		expect(updated.body.data).toMatchObject({ name: "First", description: "Changed" });

		await api.post(path, { name: "Second" }, { headers });
		const list = await api.get<{ data: { name: string }[]; meta: { total: number } }>(
			`${path}?pageSize=10`,
			{ headers },
		);
		expect(list.status).toBe(200);
		expect(list.body.meta.total).toBe(2);
		expect(list.body.data.map((item) => item.name)).toEqual(["Second", "First"]);

		const removed = await api.delete(`${path}/${id}`, { headers });
		expect(removed.status).toBe(204);
		const gone = await api.get(`${path}/${id}`, { headers });
		expect(gone.status).toBe(404);
	});

	it("rejects invalid input", async () => {
		const res = await api.post(path, { name: "" }, { headers });
		expect(res.status).toBe(400);
		expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
	});

	// tatara:slot test-cases
});
