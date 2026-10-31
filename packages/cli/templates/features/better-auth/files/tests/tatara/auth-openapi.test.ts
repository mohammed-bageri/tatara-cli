import { describe, expect, it } from "vitest";
import { api } from "#tests/helpers/api";

interface Document {
	paths: Record<string, Record<string, { tags?: string[] }>>;
	components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
}

async function apiDocument(): Promise<Document> {
	const res = await api.get<Document>("/openapi.json");
	expect(res.status).toBe(200);
	return res.body;
}

function refs(value: unknown): string[] {
	return [...JSON.stringify(value).matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)].map(
		(match) => match[1] ?? "",
	);
}

describe("OpenAPI document", () => {
	it("documents better-auth endpoints next to the app's own", async () => {
		const doc = await apiDocument();
		expect(doc.paths["/api/auth/get-session"]?.get).toBeDefined();
		expect(doc.paths["/api/me"]?.get).toBeDefined();
	});

	it("tags better-auth operations as Auth", async () => {
		const doc = await apiDocument();
		expect(doc.paths["/api/auth/get-session"]?.get?.tags).toEqual(["Auth"]);
	});

	it("prefixes better-auth schemas so app schemas keep their names", async () => {
		const doc = await apiDocument();
		expect(doc.components.schemas.AuthUser).toBeDefined();
		expect(doc.components.schemas.Principal).toBeDefined();
		expect(doc.components.securitySchemes.bearerAuth).toBeDefined();
	});

	it("resolves every schema reference", async () => {
		const doc = await apiDocument();
		const missing = refs(doc).filter((name) => !(name in doc.components.schemas));
		expect(missing).toEqual([]);
	});
});
