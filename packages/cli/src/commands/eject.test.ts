import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadProject, type Project } from "../project/config.ts";
import { EjectError, eject } from "./eject.ts";

const lib = (
	name: string,
	peers: Record<string, string>,
	src: Record<string, string>,
	extra = {},
) => ({
	[`node_modules/@tatara/${name}/package.json`]: JSON.stringify({
		name: `@tatara/${name}`,
		version: "0.1.0",
		peerDependencies: peers,
		...extra,
	}),
	...Object.fromEntries(
		Object.entries(src).map(([f, t]) => [`node_modules/@tatara/${name}/src/${f}`, t]),
	),
});

function app(files: Record<string, string> = {}, deps: Record<string, string> = {}): Project {
	const root = mkdtempSync(join(tmpdir(), "tatara-eject-"));
	const all: Record<string, string> = {
		"package.json": JSON.stringify({
			name: "app",
			imports: { "#core/*": "./src/core/*.ts" },
			dependencies: {
				"@tatara/http": "^0.1.0",
				"@tatara/auth": "^0.1.0",
				hono: "4.13.13",
				...deps,
			},
			devDependencies: { "@tatara/cli": "^0.7.0" },
		}),
		"tatara.json": JSON.stringify({
			version: "0.7.0",
			name: "app",
			orm: "none",
			database: "none",
			auth: "better-auth",
			authMethods: [],
			addons: [],
			packageManager: "pnpm",
		}),
		...lib(
			"http",
			{ hono: "^4.13.13", "@scalar/hono-api-reference": "^0.12.12", zod: "^4.6.7" },
			{
				"index.ts": 'export * from "./errors.ts";\n',
				"errors.ts": "export class AppError extends Error {}\n",
				"http.test.ts": "// test\n",
			},
			{ peerDependenciesMeta: { zod: { optional: true } } },
		),
		...lib(
			"auth",
			{ "@tatara/http": "^0.1.0", hono: "^4.13.13" },
			{
				"index.ts":
					'import { UnauthorizedError } from "@tatara/http";\nexport const x = UnauthorizedError;\n',
				"testing.ts": "export const t = 1;\n",
			},
		),
		"src/core/http/app.ts":
			'import { createApp } from "@tatara/http";\nimport { requireAuth } from "@tatara/auth";\n',
		"tests/helpers/auth.ts": "import { createTestUser } from '@tatara/auth/testing';\n",
		...files,
	};
	for (const [path, text] of Object.entries(all)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	return loadProject(root);
}

const read = (project: Project, path: string) => readFileSync(join(project.root, path), "utf8");
const json = (project: Project, path: string) => JSON.parse(read(project, path));

describe("tatara eject", () => {
	it("copies the source, points imports at it and records it", async () => {
		const project = app();
		const report = await eject(project, "auth");
		expect(report.copied.sort()).toEqual([
			"src/ejected/auth/index.ts",
			"src/ejected/auth/testing.ts",
		]);
		expect(read(project, "src/core/http/app.ts")).toContain('from "#ejected/auth/index"');
		expect(read(project, "src/core/http/app.ts")).toContain('from "@tatara/http"');
		expect(read(project, "tests/helpers/auth.ts")).toContain("from '#ejected/auth/testing'");
		const pkg = json(project, "package.json");
		expect(pkg.dependencies["@tatara/auth"]).toBeUndefined();
		expect(pkg.imports["#ejected/*"]).toBe("./src/ejected/*.ts");
		expect(pkg.imports["#core/*"]).toBe("./src/core/*.ts");
		expect(json(project, "tatara.json").ejected).toEqual({ auth: "0.1.0" });
	});

	it("refuses while another installed package depends on it, and names them", async () => {
		const project = app();
		await expect(eject(project, "@tatara/http")).rejects.toThrow(
			/@tatara\/auth depend on @tatara\/http\. Eject them too with --with-dependents/,
		);
		expect(existsSync(join(project.root, "src/ejected"))).toBe(false);
	});

	it("ejects the dependents too when asked, so there is one copy of shared classes", async () => {
		const project = app();
		const report = await eject(project, "http", { withDependents: true });
		expect(report.ejected).toEqual(["http", "auth"]);
		expect(existsSync(join(project.root, "src/ejected/http/http.test.ts"))).toBe(false);
		expect(read(project, "src/ejected/auth/index.ts")).toContain('from "#ejected/http/index"');
		expect(read(project, "src/ejected/http/index.ts")).toContain('from "./errors.ts"');
		expect(json(project, "tatara.json").ejected).toEqual({ http: "0.1.0", auth: "0.1.0" });
	});

	it("lists required peers the app relied on implicitly, but not optional ones", async () => {
		const project = app();
		const report = await eject(project, "http", { withDependents: true });
		expect(report.added).toEqual(["@scalar/hono-api-reference"]);
		expect(json(project, "package.json").dependencies["@scalar/hono-api-reference"]).toBe(
			"^0.12.12",
		);
		expect(json(project, "package.json").dependencies.zod).toBeUndefined();
	});

	it.each([
		["cli", /is a tool/],
		["jobs", /is not a dependency/],
	])("refuses %s", async (name, message) => {
		await expect(eject(app(), name)).rejects.toThrow(message);
	});

	it("refuses twice, and a package without source", async () => {
		const project = app();
		await eject(project, "auth");
		await expect(eject(loadProject(project.root), "auth")).rejects.toThrow(/already ejected/);
		const old = app({ "node_modules/@tatara/auth/src/index.ts": "" });
		const { rmSync } = await import("node:fs");
		rmSync(join(old.root, "node_modules/@tatara/auth/src"), { recursive: true });
		await expect(eject(old, "auth")).rejects.toBeInstanceOf(EjectError);
	});
});
