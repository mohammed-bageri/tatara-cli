import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { upgrade } from "../../commands/upgrade.ts";
import { loadProject, type Project } from "../../project/config.ts";
import { hashContent } from "../../project/hashes.ts";
import type { Baseline } from "../baseline.ts";
import { dbTesting } from "./db-testing.ts";

const OLD: Record<string, string> = {
	"src/core/db/id.ts": "export function newId() {}\n",
	"src/core/db/seed.ts": "export function defineSeed() {}\n",
	"src/core/db/admin.ts": 'import pg from "pg";\nexport async function ensureDatabase() {}\n',
	"src/core/db/migrate.ts": "export async function migrateDatabase() {}\n",
	"tests/helpers/database-url.ts": "export const TEST_WORKERS = 4;\n",
	"tests/helpers/api.ts": 'import { app as apiApp } from "#apps/api/app";\n// old client\n',
	"tests/global-setup.ts":
		'import { TEST_WORKERS } from "#tests/helpers/database-url";\n// old setup\n',
};

function app(overrides: Record<string, string> = {}, database = "postgres"): Project {
	const root = mkdtempSync(join(tmpdir(), "tatara-db-codemod-"));
	const files: Record<string, string> = {
		...OLD,
		"src/modules/notes/services/notes.ts": 'import { newId } from "#core/db/id";\n',
		"src/modules/notes/db/seed.ts": 'import { defineSeed } from "#core/db/seed";\n',
		"package.json": JSON.stringify({ name: "app", dependencies: {}, devDependencies: {} }),
		"tatara.json": JSON.stringify({
			version: "0.3.0",
			name: "notes-app",
			orm: "prisma",
			database,
			auth: "none",
			authMethods: [],
			addons: [],
			packageManager: "pnpm",
			generated: {
				cli: "0.3.0",
				files: Object.fromEntries(Object.entries(OLD).map(([p, t]) => [p, hashContent(t)])),
			},
		}),
		...overrides,
	};
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	return loadProject(root);
}

const recorded = (project: Project): Baseline => ({
	async isUnchanged(path, content) {
		return project.config.generated?.files[path] === hashContent(content);
	},
});
const run = (project: Project) =>
	upgrade(project, {
		cliVersion: "0.4.0",
		codemods: [dbTesting],
		baseline: recorded(project),
		runSync: async () => {},
		runInstall: async () => {},
		formatFile: async () => {},
	});
const read = (project: Project, path: string) => readFileSync(join(project.root, path), "utf8");

describe("0.4.0 db-testing codemod", () => {
	it("adds the packages, removes the copies and rewrites imports", async () => {
		const project = app();
		const report = await run(project);
		expect(report.removed.sort()).toEqual([
			"src/core/db/id.ts",
			"src/core/db/seed.ts",
			"tests/helpers/database-url.ts",
		]);
		const pkg = JSON.parse(read(project, "package.json"));
		expect(pkg.dependencies["@tatara/db"]).toMatch(/^\^0\./);
		expect(pkg.devDependencies["@tatara/testing"]).toMatch(/^\^0\./);
		expect(read(project, "src/modules/notes/services/notes.ts")).toContain('from "@tatara/db"');
		expect(read(project, "src/modules/notes/db/seed.ts")).toContain('from "@tatara/db"');
	});

	it("turns unchanged driver files into re-exports for the app's database", async () => {
		const project = app();
		await run(project);
		expect(read(project, "src/core/db/admin.ts")).toContain('from "@tatara/db/postgres"');
		expect(read(project, "src/core/db/migrate.ts")).toContain('from "@tatara/db/prisma"');
		expect(read(project, "tests/helpers/api.ts")).toContain('from "@tatara/testing"');
		expect(read(project, "tests/global-setup.ts")).toContain("prepareTestDatabases");
	});

	it("uses the mariadb helpers for Prisma on MySQL", async () => {
		const project = app({}, "mysql");
		await run(project);
		expect(read(project, "src/core/db/admin.ts")).toContain('from "@tatara/db/mariadb"');
	});

	it("keeps a customised admin.ts and says so", async () => {
		const custom = 'import pg from "pg";\nexport async function ensureDatabase() {} // mine\n';
		const project = app({ "src/core/db/admin.ts": custom });
		const report = await run(project);
		expect(read(project, "src/core/db/admin.ts")).toBe(custom);
		expect(report.notes.join("\n")).toContain("src/core/db/admin.ts");
	});

	it("skips the database part for apps without one", async () => {
		const project = app({}, "none");
		const report = await run(project);
		expect(JSON.parse(read(project, "package.json")).dependencies["@tatara/db"]).toBeUndefined();
		expect(report.removed).toEqual(["tests/helpers/database-url.ts"]);
	});
});
