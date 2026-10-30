import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadProject } from "../project/config.ts";
import { hashContent } from "../project/hashes.ts";
import type { Baseline } from "../upgrade/baseline.ts";
import type { Codemod } from "../upgrade/codemods.ts";
import { upgrade } from "./upgrade.ts";

const ORIGINAL = "export class NotFoundError extends Error {}\n";

function fixture(files: Record<string, string> = {}, version = "0.1.3") {
	const root = mkdtempSync(join(tmpdir(), "tatara-upgrade-"));
	const all: Record<string, string> = {
		"tatara.json": JSON.stringify({
			version,
			name: "app",
			orm: "none",
			database: "none",
			auth: "none",
			authMethods: [],
			addons: [],
			packageManager: "pnpm",
			generated: { cli: version, files: { "src/core/http/errors.ts": hashContent(ORIGINAL) } },
		}),
		"package.json": JSON.stringify({ name: "app", dependencies: {}, devDependencies: {} }),
		"src/core/http/errors.ts": ORIGINAL,
		...files,
	};
	for (const [path, text] of Object.entries(all)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	return loadProject(root);
}

const read = (root: string, path: string) => readFileSync(join(root, path), "utf8");
const recordedOnly: (project: ReturnType<typeof fixture>) => Baseline = (project) => ({
	async isUnchanged(path, content) {
		return project.config.generated?.files[path] === hashContent(content);
	},
});
const deps = (project: ReturnType<typeof fixture>, cli = "0.1.5") => ({
	cliVersion: cli,
	baseline: recordedOnly(project),
	runSync: async () => {},
});

describe("upgrade", () => {
	it("runs codemods newer than the app, in order", async () => {
		const project = fixture();
		const ran: string[] = [];
		const mod = (version: string): Codemod => ({
			version,
			id: `mod-${version}`,
			description: version,
			run: async () => {
				ran.push(version);
			},
		});
		await upgrade(project, {
			...deps(project),
			codemods: [mod("0.1.5"), mod("0.1.2"), mod("0.1.4")],
		});
		expect(ran).toEqual(["0.1.4", "0.1.5"]);
		expect(JSON.parse(read(project.root, "tatara.json")).version).toBe("0.1.5");
	});

	it("removes unchanged files and keeps changed ones with a diff", async () => {
		const project = fixture({ "src/core/http/response.ts": "export const edited = true;\n" });
		const report = await upgrade(project, {
			...deps(project),
			codemods: [
				{
					version: "0.1.4",
					id: "move-http",
					description: "",
					run: async (ctx) => {
						await ctx.removeIfUnchanged("src/core/http/errors.ts");
						await ctx.removeIfUnchanged("src/core/http/response.ts");
					},
				},
			],
		});
		expect(report.removed).toEqual(["src/core/http/errors.ts"]);
		expect(report.kept.map((k) => k.path)).toEqual(["src/core/http/response.ts"]);
		expect(report.kept[0]?.diff).toContain("edited");
	});

	it("rewrites imports", async () => {
		const project = fixture({
			"src/modules/x/services/x.ts":
				'import { NotFoundError } from "#core/http/errors";\nimport { y } from "#core/http/errors-extra";\n',
		});
		await upgrade(project, {
			...deps(project),
			codemods: [
				{
					version: "0.1.4",
					id: "imports",
					description: "",
					run: async (ctx) => {
						expect(await ctx.rewriteImports("#core/http/errors", "@tatara/http")).toBe(1);
					},
				},
			],
		});
		const text = read(project.root, "src/modules/x/services/x.ts");
		expect(text).toContain('from "@tatara/http"');
		expect(text).toContain('from "#core/http/errors-extra"');
	});

	it("is idempotent", async () => {
		const project = fixture();
		const mods: Codemod[] = [
			{
				version: "0.1.4",
				id: "once",
				description: "",
				run: async (ctx) => {
					await ctx.removeIfUnchanged("src/core/http/errors.ts");
				},
			},
		];
		await upgrade(project, { ...deps(project), codemods: mods });
		const after = read(project.root, "tatara.json");
		const again = loadProject(project.root);
		const report = await upgrade(again, { ...deps(again), codemods: mods });
		expect(report).toMatchObject({ ran: [], removed: [], kept: [] });
		expect(read(project.root, "tatara.json")).toBe(after);
	});

	it("keeps the old version when a codemod fails", async () => {
		const project = fixture();
		const run = upgrade(project, {
			...deps(project),
			codemods: [
				{
					version: "0.1.4",
					id: "writes",
					description: "",
					run: async (ctx) => ctx.write("src/written.ts", "ok\n"),
				},
				{
					version: "0.1.5",
					id: "breaks",
					description: "",
					run: async () => {
						throw new Error("boom");
					},
				},
			],
		});
		await expect(run).rejects.toThrow(/breaks/);
		expect(read(project.root, "src/written.ts")).toBe("ok\n");
		expect(JSON.parse(read(project.root, "tatara.json")).version).toBe("0.1.3");
	});

	it("dry run writes nothing", async () => {
		const project = fixture();
		const before = read(project.root, "tatara.json");
		const report = await upgrade(project, {
			...deps(project),
			dryRun: true,
			codemods: [
				{
					version: "0.1.4",
					id: "remove",
					description: "",
					run: async (ctx) => {
						await ctx.removeIfUnchanged("src/core/http/errors.ts");
					},
				},
			],
		});
		expect(report.removed).toEqual(["src/core/http/errors.ts"]);
		expect(read(project.root, "src/core/http/errors.ts")).toBe(ORIGINAL);
		expect(read(project.root, "tatara.json")).toBe(before);
	});

	it("keeps an edited framework file across two upgrades", async () => {
		const project = fixture({ "src/core/http/errors.ts": "export class Mine {}\n" });
		await upgrade(project, { ...deps(project, "0.1.4"), codemods: [] });
		const later = loadProject(project.root);
		const report = await upgrade(later, {
			...deps(later, "0.1.5"),
			codemods: [
				{
					version: "0.1.5",
					id: "remove",
					description: "",
					run: async (ctx) => {
						await ctx.removeIfUnchanged("src/core/http/errors.ts");
					},
				},
			],
		});
		expect(report.kept.map((k) => k.path)).toEqual(["src/core/http/errors.ts"]);
		expect(read(project.root, "src/core/http/errors.ts")).toBe("export class Mine {}\n");
	});

	it("formats tatara.json after changing the version", async () => {
		const project = fixture();
		const formatted: string[] = [];
		await upgrade(project, {
			...deps(project),
			codemods: [],
			formatFile: async (file) => {
				formatted.push(file);
			},
		});
		expect(formatted).toEqual(["tatara.json"]);
	});
});
