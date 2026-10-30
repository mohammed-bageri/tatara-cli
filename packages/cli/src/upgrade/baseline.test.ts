import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Project, ProjectConfig } from "../project/config.ts";
import { hashContent } from "../project/hashes.ts";
import { createBaseline, releaseBaseline, renderRelease } from "./baseline.ts";

const minimalConfig: ProjectConfig = {
	version: "0.1.1",
	name: "app",
	orm: "none",
	database: "none",
	auth: "none",
	authMethods: [],
	addons: [],
	packageManager: "pnpm",
};

const project = (config: Partial<ProjectConfig> = {}): Project => ({
	root: "/nowhere",
	config: { ...minimalConfig, ...config },
	has: () => false,
});

describe("createBaseline", () => {
	it("uses the recorded hash first", async () => {
		const releaseBaselineFn = vi.fn();
		const baseline = createBaseline(
			project({ generated: { cli: "0.1.1", files: { "src/core/a.ts": hashContent("same\n") } } }),
			{
				releasedVersions: async () => ["0.1.1"],
				releaseBaseline: releaseBaselineFn,
				cliVersion: "0.1.3",
			},
		);
		expect(await baseline.isUnchanged("src/core/a.ts", "same\n")).toBe(true);
		expect(releaseBaselineFn).not.toHaveBeenCalled();
	});

	it("falls back to released templates", async () => {
		const baseline = createBaseline(project(), {
			releasedVersions: async () => ["0.1.0", "0.1.1", "0.1.2", "0.1.3"],
			releaseBaseline: async (version) =>
				version === "0.1.2" ? { "src/core/a.ts": hashContent("released\n") } : {},
			cliVersion: "0.1.3",
		});
		expect(await baseline.isUnchanged("src/core/a.ts", "released\n")).toBe(true);
	});

	it("only considers releases from the app's version up to the CLI's", async () => {
		const seen: string[] = [];
		const baseline = createBaseline(project({ version: "0.1.1" }), {
			releasedVersions: async () => ["0.1.0", "0.1.1", "0.1.2", "0.1.3", "0.2.0"],
			releaseBaseline: async (version) => {
				seen.push(version);
				return {};
			},
			cliVersion: "0.1.3",
		});
		await baseline.isUnchanged("src/core/a.ts", "x");
		expect(seen.sort()).toEqual(["0.1.1", "0.1.2", "0.1.3"]);
	});

	it("reports a changed file", async () => {
		const baseline = createBaseline(project(), {
			releasedVersions: async () => ["0.1.1"],
			releaseBaseline: async () => ({ "src/core/a.ts": hashContent("released\n") }),
			cliVersion: "0.1.3",
		});
		expect(await baseline.isUnchanged("src/core/a.ts", "edited\n")).toBe(false);
	});
});

describe("releaseBaseline", () => {
	it.runIf(process.env.TATARA_NETWORK_TESTS)(
		"treats a reformatted template file as unchanged",
		async () => {
			// an app whose Biome settings differ from the templates' (spaces, width 60)
			const app = mkdtempSync(join(tmpdir(), "tatara-fmt-app-"));
			symlinkSync(join(import.meta.dirname, "../../../../node_modules"), join(app, "node_modules"));
			writeFileSync(
				join(app, "biome.json"),
				JSON.stringify({ formatter: { indentStyle: "space", lineWidth: 60 } }),
			);
			const rendered = await renderRelease("0.1.3", minimalConfig);
			const file = "src/core/http/app.ts";
			const copy = mkdtempSync(join(tmpdir(), "tatara-fmt-copy-"));
			cpSync(join(app, "biome.json"), join(copy, "biome.json"));
			cpSync(join(rendered, file), join(copy, "app.ts"));
			execFileSync(join(app, "node_modules/.bin/biome"), ["check", "--write", "app.ts"], {
				cwd: copy,
			});
			const formattedByApp = hashContent(readFileSync(join(copy, "app.ts"), "utf8"));

			const baseline = await releaseBaseline("0.1.3", minimalConfig, { formatWith: app });
			expect(baseline[file]).toBe(formattedByApp);
		},
		180_000,
	);
});
