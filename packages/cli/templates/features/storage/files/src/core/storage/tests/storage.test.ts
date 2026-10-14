import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { localStorage } from "#core/storage/local";

describe("local storage", () => {
	it("round-trips an object", async () => {
		const store = localStorage(await mkdtemp(join(tmpdir(), "storage-")));
		await store.put("a/b.txt", "hello");
		expect(new TextDecoder().decode((await store.get("a/b.txt")) ?? new Uint8Array())).toBe("hello");
		await store.delete("a/b.txt");
		expect(await store.get("a/b.txt")).toBeNull();
	});

	it("rejects keys that escape the root", async () => {
		const store = localStorage(await mkdtemp(join(tmpdir(), "storage-")));
		await expect(store.put("../x", "no")).rejects.toThrow(/Invalid storage key/);
	});
});
