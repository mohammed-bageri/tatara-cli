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
	runInstall: async () => {},
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

	it("records the version before a blocked codemod, so the next upgrade runs it again", async () => {
		const project = fixture();
		const ran: string[] = [];
		const mod = (version: string, blocked = false): Codemod => ({
			version,
			id: `mod-${version}`,
			description: version,
			run: async (ctx) => {
				ran.push(version);
				if (blocked) ctx.report.blocked.push(`mod-${version}`);
			},
		});
		const report = await upgrade(project, {
			...deps(project, "0.1.6"),
			codemods: [mod("0.1.4"), mod("0.1.5", true), mod("0.1.6")],
		});
		expect(report.blocked).toEqual(["mod-0.1.5"]);
		const config = JSON.parse(read(project.root, "tatara.json"));
		expect(config.version).toBe("0.1.4");
		expect(config.generated.cli).toBe("0.1.4");

		ran.length = 0;
		const again = loadProject(project.root);
		await upgrade(again, {
			...deps(again, "0.1.6"),
			codemods: [mod("0.1.4"), mod("0.1.5"), mod("0.1.6")],
		});
		expect(ran).toEqual(["0.1.5", "0.1.6"]);
		expect(JSON.parse(read(project.root, "tatara.json")).version).toBe("0.1.6");
	});

	it("keeps the app's version when the first due codemod is blocked", async () => {
		const project = fixture();
		await upgrade(project, {
			...deps(project, "0.1.4"),
			codemods: [
				{
					version: "0.1.4",
					id: "blocked",
					description: "",
					run: async (ctx) => {
						ctx.report.blocked.push("blocked");
					},
				},
			],
		});
		expect(JSON.parse(read(project.root, "tatara.json")).version).toBe("0.1.3");
	});

	it("leaves ejected packages alone: no dependency, imports point at the app's copy", async () => {
		const project = fixture({
			"tatara.json": JSON.stringify({
				version: "0.1.3",
				name: "app",
				orm: "none",
				database: "none",
				auth: "none",
				authMethods: [],
				addons: [],
				packageManager: "pnpm",
				ejected: { http: "0.1.0" },
			}),
			"src/modules/x/services/x.ts": 'import { NotFoundError } from "#core/http/errors";\n',
		});
		const report = await upgrade(project, {
			...deps(project),
			codemods: [
				{
					version: "0.1.4",
					id: "to-http",
					description: "",
					run: async (ctx) => {
						await ctx.addDependency("@tatara/http", "^0.1.0");
						await ctx.rewriteImports("#core/http/errors", "@tatara/http");
					},
				},
			],
		});
		expect(
			JSON.parse(read(project.root, "package.json")).dependencies["@tatara/http"],
		).toBeUndefined();
		expect(read(project.root, "src/modules/x/services/x.ts")).toContain(
			'from "#ejected/http/index"',
		);
		expect(report.notes.join("\n")).toContain("@tatara/http is ejected");
	});

	it("regenerate removes an unchanged file this CLI no longer generates", async () => {
		const project = fixture();
		const report = await upgrade(project, {
			...deps(project),
			codemods: [
				{
					version: "0.1.4",
					id: "regen",
					description: "",
					run: async (ctx) => {
						expect(await ctx.regenerate("src/core/http/errors.ts")).toBe("removed");
					},
				},
			],
		});
		expect(report.removed).toEqual(["src/core/http/errors.ts"]);
	});

	it("bumps @tatara/* dependencies to this CLI's versions, then installs before sync", async () => {
		const project = fixture({
			"package.json": JSON.stringify({
				name: "app",
				dependencies: { "@tatara/core": "^0.0.1", hono: "1.0.0" },
				devDependencies: { "@tatara/testing": "^0.0.1", "@tatara/cli": "^0.0.1" },
			}),
		});
		const order: string[] = [];
		await upgrade(project, {
			...deps(project),
			codemods: [],
			runInstall: async () => void order.push("install"),
			runSync: async () => void order.push("sync"),
		});
		const pkg = JSON.parse(read(project.root, "package.json"));
		expect(pkg.dependencies["@tatara/core"]).toMatch(/^\^0\.[1-9]/);
		expect(pkg.devDependencies["@tatara/testing"]).toMatch(/^\^0\.[1-9]/);
		expect(pkg.dependencies.hono).toBe("1.0.0");
		// the app installs the CLI it upgrades with; upgrade leaves that pin alone
		expect(pkg.devDependencies["@tatara/cli"]).toBe("^0.0.1");
		expect(order).toEqual(["install", "sync"]);
	});

	it("installs even when package.json did not change, so a re-run after a failed install works", async () => {
		const project = fixture();
		const order: string[] = [];
		await upgrade(project, {
			...deps(project),
			codemods: [],
			runInstall: async () => void order.push("install"),
			runSync: async () => void order.push("sync"),
		});
		expect(order).toEqual(["install", "sync"]);
	});

	it("keeps the old version when the install fails", async () => {
		const project = fixture();
		await expect(
			upgrade(project, {
				...deps(project),
				codemods: [],
				runInstall: async () => {
					throw new Error("network");
				},
			}),
		).rejects.toThrow("network");
		expect(JSON.parse(read(project.root, "tatara.json")).version).toBe("0.1.3");
	});

	it("only raises plain ^ ranges: never lowers them or touches pins and file: specs", async () => {
		const project = fixture({
			"package.json": JSON.stringify({
				name: "app",
				dependencies: {
					"@tatara/core": "^99.0.0",
					"@tatara/http": "file:../http.tgz",
					"@tatara/db": "0.0.1",
				},
			}),
		});
		await upgrade(project, { ...deps(project), codemods: [] });
		expect(JSON.parse(read(project.root, "package.json")).dependencies).toEqual({
			"@tatara/core": "^99.0.0",
			"@tatara/http": "file:../http.tgz",
			"@tatara/db": "0.0.1",
		});
	});

	it("regenerate keeps a no-longer-generated file that other code still imports", async () => {
		const project = fixture({
			"src/modules/x/services/x.ts": 'import { NotFoundError } from "#core/http/errors";\n',
		});
		const report = await upgrade(project, {
			...deps(project),
			codemods: [
				{
					version: "0.1.4",
					id: "regen",
					description: "",
					run: async (ctx) => {
						expect(await ctx.regenerate("src/core/http/errors.ts")).toBe("kept");
					},
				},
			],
		});
		expect(report.removed).toEqual([]);
		expect(report.notes.join("\n")).toContain("src/modules/x/services/x.ts");
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

	it("does not record a customised file as generated when a codemod edits it", async () => {
		const project = fixture({
			"src/core/http/app.ts": 'import { x } from "#core/old";\n// customised\n',
		});
		await upgrade(project, {
			...deps(project, "0.1.4"),
			codemods: [
				{
					version: "0.1.4",
					id: "imports",
					description: "",
					run: async (ctx) => {
						await ctx.rewriteImports("#core/old", "@tatara/new");
					},
				},
			],
		});
		const later = loadProject(project.root);
		expect(later.config.generated?.files["src/core/http/app.ts"]).toBeUndefined();
	});

	it("records an edited file that was unchanged before the edit", async () => {
		const project = fixture({ "src/core/http/errors.ts": 'import { x } from "#core/old";\n' });
		const original = 'import { x } from "#core/old";\n';
		const recorded = {
			...project.config.generated?.files,
			"src/core/http/errors.ts": hashContent(original),
		};
		const withRecord = {
			...project,
			config: { ...project.config, generated: { cli: "0.1.3", files: recorded } },
		};
		await upgrade(withRecord, {
			...deps(withRecord, "0.1.4"),
			codemods: [
				{
					version: "0.1.4",
					id: "imports",
					description: "",
					run: async (ctx) => {
						await ctx.rewriteImports("#core/old", "@tatara/new");
					},
				},
			],
		});
		expect(loadProject(project.root).config.generated?.files["src/core/http/errors.ts"]).toBe(
			hashContent('import { x } from "@tatara/new";\n'),
		);
	});
});
