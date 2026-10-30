import { describe, expect, it } from "vitest";
import { defineSeed, newId } from "./index.ts";
import { connectionConfig } from "./mariadb.ts";

describe("newId", () => {
	it("is a version 7 UUID", () => {
		expect(newId()).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
	});
	it("sorts by creation time", async () => {
		const a = newId();
		await new Promise((r) => setTimeout(r, 2));
		expect(newId() > a).toBe(true);
	});
});

describe("defineSeed", () => {
	it("returns the definition", () => {
		const seed = { name: "x", run: async () => {} };
		expect(defineSeed(seed)).toBe(seed);
	});
});

describe("mariadb connectionConfig", () => {
	it("reads a mysql:// URL", () => {
		expect(connectionConfig("mysql://u%40x:p%23w@db.example:3307/app")).toMatchObject({
			host: "db.example",
			port: 3307,
			user: "u@x",
			password: "p#w",
			database: "app",
			allowPublicKeyRetrieval: false,
		});
	});
	it("allows public key retrieval only for local hosts or when asked", () => {
		expect(connectionConfig("mysql://u:p@localhost/app").allowPublicKeyRetrieval).toBe(true);
		expect(
			connectionConfig("mysql://u:p@db.example/app?allowPublicKeyRetrieval=true")
				.allowPublicKeyRetrieval,
		).toBe(true);
	});
	it("turns on verified TLS with ?ssl=true", () => {
		expect(connectionConfig("mysql://u:p@db.example/app?ssl=true").ssl).toEqual({
			rejectUnauthorized: true,
		});
	});
});
