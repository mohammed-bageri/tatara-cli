import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { client, prepareTestDatabases, TEST_WORKERS, workerDatabaseUrl } from "./index.ts";

describe("client", () => {
	const app = new Hono();
	app.post("/echo", async (c) =>
		c.json({ got: await c.req.json(), auth: c.req.header("authorization") ?? null }),
	);
	app.get("/text", (c) => c.text("plain"));
	const api = client(app);

	it("sends JSON and parses JSON", async () => {
		const res = await api.post<{ got: unknown; auth: string }>(
			"/echo",
			{ a: 1 },
			{ headers: { authorization: "Bearer t" } },
		);
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ got: { a: 1 }, auth: "Bearer t" });
	});

	it("keeps a non-JSON body as text", async () => {
		expect((await api.get("/text")).body).toBe("plain");
	});
});

describe("test databases", () => {
	it("gives each worker its own database", () => {
		expect(workerDatabaseUrl("postgres://u:p@localhost:5432/app_test", 3)).toBe(
			"postgres://u:p@localhost:5432/app_test_3",
		);
	});

	it("creates and migrates one database per worker", async () => {
		const ensureDatabase = vi.fn(async () => {});
		const migrateDatabase = vi.fn(async () => {});
		await prepareTestDatabases({
			baseUrl: "postgres://localhost/app_test",
			ensureDatabase,
			migrateDatabase,
		});
		expect(ensureDatabase).toHaveBeenCalledTimes(TEST_WORKERS);
		expect(migrateDatabase).toHaveBeenCalledWith("postgres://localhost/app_test_1");
	});

	it("explains a failure", async () => {
		await expect(
			prepareTestDatabases({
				baseUrl: "postgres://localhost/app_test",
				ensureDatabase: async () => {
					throw new Error("ECONNREFUSED");
				},
				migrateDatabase: async () => {},
			}),
		).rejects.toThrow(/Is the database running\?.*ECONNREFUSED/s);
	});
});
