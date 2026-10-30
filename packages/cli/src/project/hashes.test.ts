import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { hashContent, hashTrackedFiles } from "./hashes.ts";

function tree(files: Record<string, string>): string {
	const root = mkdtempSync(join(tmpdir(), "tatara-hashes-"));
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	return root;
}

describe("hashTrackedFiles", () => {
	it("hashes only framework files", async () => {
		const root = tree({
			"src/core/http/app.ts": "export const a = 1;\n",
			"src/modules/x/routes/x.routes.ts": "export {};\n",
			"tests/helpers/api.ts": "export {};\n",
			"src/generated/routes.ts": "export {};\n",
		});
		expect(Object.keys(await hashTrackedFiles(root)).sort()).toEqual([
			"src/core/http/app.ts",
			"tests/helpers/api.ts",
		]);
	});

	it("uses forward slashes on every platform", async () => {
		const root = tree({ "src/core/http/app.ts": "x\n" });
		for (const key of Object.keys(await hashTrackedFiles(root))) expect(key).not.toContain("\\");
	});
});

describe("hashContent", () => {
	it("is stable for the same content", () => expect(hashContent("a\n")).toBe(hashContent("a\n")));
	it("changes when one byte changes", () =>
		expect(hashContent("a\n")).not.toBe(hashContent("b\n")));
	it("is labelled sha256", () => expect(hashContent("a")).toMatch(/^sha256-/));
});
