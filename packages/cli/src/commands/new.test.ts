import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { hashContent } from "../project/hashes.ts";
import { newApp } from "./new.ts";

it("records hashes without installing", async () => {
	const root = await newApp(join(mkdtempSync(join(tmpdir(), "tatara-new-")), "app"), {
		yes: true,
		install: false,
		git: false,
		orm: "none",
		db: "none",
		auth: "none",
		pm: "pnpm",
	});
	const config = JSON.parse(readFileSync(join(root, "tatara.json"), "utf8")) as {
		version: string;
		generated?: { cli: string; files: Record<string, string> };
	};
	expect(config.generated?.cli).toBe(config.version);
	expect(config.generated?.files["src/apps/http.ts"]).toBe(
		hashContent(readFileSync(join(root, "src/apps/http.ts"), "utf8")),
	);
});
