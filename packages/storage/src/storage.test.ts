import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { localStorage } from "./index.ts";
import { ensureBucket, s3Storage } from "./s3.ts";

describe("localStorage", () => {
	it("round-trips an object", async () => {
		const store = localStorage(await mkdtemp(join(tmpdir(), "storage-")));
		await store.put("a/b.txt", "hello");
		expect(new TextDecoder().decode((await store.get("a/b.txt")) ?? new Uint8Array())).toBe(
			"hello",
		);
		await store.delete("a/b.txt");
		expect(await store.get("a/b.txt")).toBeNull();
	});

	it("rejects keys that escape the root", async () => {
		const store = localStorage(await mkdtemp(join(tmpdir(), "storage-")));
		for (const key of [
			"../x",
			"a/../../x",
			"a\\..\\x",
			"/etc/passwd",
			"C:/x",
			"a/\0b",
			"",
			"./x",
		]) {
			await expect(store.put(key, "no")).rejects.toThrow(/Invalid storage key/);
		}
	});
});

describe("s3Storage", () => {
	const client = () => {
		const c = new S3Client({
			region: "us-east-1",
			credentials: { accessKeyId: "a", secretAccessKey: "b" },
		});
		return c;
	};

	it("creates the bucket once before the first write when asked", async () => {
		const c = client();
		const sent: string[] = [];
		vi.spyOn(c, "send").mockImplementation(async (command: { constructor: { name: string } }) => {
			sent.push(command.constructor.name);
			if (command.constructor.name === "HeadBucketCommand") throw new Error("missing");
			return {};
		});
		const store = s3Storage({ client: c, bucket: "b", createBucket: true });
		await store.put("x", "1");
		await store.put("y", "2");
		expect(sent).toEqual([
			"HeadBucketCommand",
			"CreateBucketCommand",
			"PutObjectCommand",
			"PutObjectCommand",
		]);
	});

	it("never touches the bucket by default, and validates keys", async () => {
		const c = client();
		const send = vi.spyOn(c, "send").mockResolvedValue({} as never);
		const store = s3Storage({ client: c, bucket: "b" });
		await store.put("x", "1");
		expect(send).toHaveBeenCalledTimes(1);
		await expect(store.get("../x")).rejects.toThrow(/Invalid storage key/);
	});

	it("reports whether ensureBucket created the bucket", async () => {
		const c = client();
		vi.spyOn(c, "send").mockResolvedValue({} as never);
		expect(await ensureBucket(c, "b")).toBe(false);
	});

	it("signs URLs without a network call", async () => {
		const url = await s3Storage({ client: client(), bucket: "b" }).url("a/b.txt", 60);
		expect(url).toMatch(/\/a\/b\.txt\?/);
		expect(url).toContain("X-Amz-Expires=60");
	});
});
