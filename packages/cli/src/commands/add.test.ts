import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderApp, writeFiles } from "../engine/generate.ts";
import type { AppOptions } from "../features/types.ts";
import { loadProject } from "../project/config.ts";
import { hashContent } from "../project/hashes.ts";
import { addAddons } from "./add.ts";

const OPTIONS: AppOptions = {
	name: "app",
	orm: "drizzle",
	database: "postgres",
	auth: "better-auth",
	authMethods: ["password"],
	addons: [],
	packageManager: "pnpm",
};

async function app(edit: (root: string) => void = () => {}) {
	const root = mkdtempSync(join(tmpdir(), "tatara-add-"));
	const files = await renderApp(OPTIONS);
	await writeFiles(root, files, { env: "PORT=3000\n" });
	const config = JSON.parse(files.get("tatara.json") as string);
	config.generated = {
		cli: config.version,
		files: Object.fromEntries(
			[...files].filter(([p]) => p !== "tatara.json").map(([p, t]) => [p, hashContent(t)]),
		),
	};
	writeFileSync(join(root, "tatara.json"), JSON.stringify(config));
	edit(root);
	return loadProject(root);
}

const quiet = {
	runInstall: async () => {},
	runSync: async () => {},
	formatFile: async () => {},
};
const read = (root: string, path: string) => readFileSync(join(root, path), "utf8");

describe("tatara add", () => {
	it("adds an add-on and the ones it brings: files, packages, env and tatara.json", async () => {
		const project = await app();
		const report = await addAddons(project, ["jobs"], {
			...quiet,
			baseline: {
				isUnchanged: async (p, c) => project.config.generated?.files[p] === hashContent(c),
			},
		});
		expect(report.added).toEqual(["jobs", "cache"]);
		expect(read(project.root, "src/core/jobs/index.ts")).toContain("createJobs");
		expect(read(project.root, "src/core/cache/index.ts")).toContain("createCache");
		const pkg = JSON.parse(read(project.root, "package.json"));
		expect(pkg.dependencies["@tatara/jobs"]).toBeDefined();
		expect(pkg.scripts["start:worker"]).toBeDefined();
		expect(read(project.root, ".env.example")).toContain("JOBS_DRIVER=");
		expect(read(project.root, ".env")).toContain("CACHE_DRIVER=");
		expect(read(project.root, ".env")).toContain("PORT=3000");
		expect(JSON.parse(read(project.root, "tatara.json")).addons).toEqual(["jobs", "cache"]);
		expect(report.written).toContain("tsdown.config.ts");
		// pnpm stops at a dependency's install script nobody allowed
		expect(read(project.root, "pnpm-workspace.yaml")).toContain('"msgpackr-extract": true');
	});

	it("allows the add-on's install scripts in a workspace file pnpm already edited", async () => {
		const project = await app((root) =>
			writeFileSync(
				join(root, "pnpm-workspace.yaml"),
				'allowBuilds:\n  "esbuild": true\n  msgpackr-extract: set this to true or false\n',
			),
		);
		await addAddons(project, ["jobs"], {
			...quiet,
			baseline: {
				isUnchanged: async (p, c) => project.config.generated?.files[p] === hashContent(c),
			},
		});
		const workspace = read(project.root, "pnpm-workspace.yaml");
		expect(workspace).toContain('"msgpackr-extract": true');
		expect(workspace).not.toContain("set this to");
		expect(workspace).toContain('"esbuild": true');
	});

	it("lists the files the app changed instead of overwriting them", async () => {
		const project = await app((root) => writeFileSync(join(root, "src/apps/http.ts"), "// mine\n"));
		const report = await addAddons(project, ["realtime"], {
			...quiet,
			baseline: {
				isUnchanged: async (p, c) => project.config.generated?.files[p] === hashContent(c),
			},
		});
		expect(read(project.root, "src/apps/http.ts")).toBe("// mine\n");
		expect(report.merge).toEqual([]);
		expect(read(project.root, "src/apps/api/server.ts")).toContain("realtime.attach");
		const custom = await app((root) =>
			writeFileSync(join(root, "src/apps/api/server.ts"), "// mine\n"),
		);
		const second = await addAddons(custom, ["realtime"], {
			...quiet,
			baseline: {
				isUnchanged: async (p, c) => custom.config.generated?.files[p] === hashContent(c),
			},
		});
		expect(read(custom.root, "src/apps/api/server.ts")).toBe("// mine\n");
		expect(second.merge).toContain("src/apps/api/server.ts");
	});

	it("refuses an add-on the app has, or one its setup can't take", async () => {
		const project = await app();
		await expect(addAddons(project, ["authz", "authz"], quiet)).resolves.toBeDefined();
		await expect(addAddons(loadProject(project.root), ["authz"], quiet)).rejects.toThrow(
			/already has authz/,
		);
		const noDb = await app();
		const config = JSON.parse(read(noDb.root, "tatara.json"));
		writeFileSync(
			join(noDb.root, "tatara.json"),
			JSON.stringify({ ...config, orm: "none", database: "none", auth: "none", authMethods: [] }),
		);
		await expect(addAddons(loadProject(noDb.root), ["notifications"], quiet)).rejects.toThrow(
			/needs/,
		);
	});
});
