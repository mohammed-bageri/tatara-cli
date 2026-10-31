import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { upgrade } from "../../commands/upgrade.ts";
import { loadProject, type Project } from "../../project/config.ts";
import { hashContent } from "../../project/hashes.ts";
import { authzStores } from "./authz-stores.ts";

const OLD = {
	"src/core/authz/index.ts": 'import { store } from "#core/authz/db/store";\n// old\n',
	"src/core/authz/db/store.ts": "export const store = {};\n",
};

function app(orm: "prisma" | "drizzle", overrides: Record<string, string> = {}): Project {
	const root = mkdtempSync(join(tmpdir(), "tatara-authz-stores-"));
	const files: Record<string, string> = {
		...OLD,
		"package.json": "{}",
		"tatara.json": JSON.stringify({
			version: "0.8.0",
			name: "app",
			orm,
			database: "postgres",
			auth: "better-auth",
			authMethods: ["password"],
			addons: ["authz"],
			packageManager: "pnpm",
			generated: {
				cli: "0.8.0",
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

const run = (project: Project) =>
	upgrade(project, {
		cliVersion: "0.9.0",
		codemods: [authzStores],
		baseline: {
			async isUnchanged(path, content) {
				return project.config.generated?.files[path] === hashContent(content);
			},
		},
		runSync: async () => {},
		runInstall: async () => {},
		formatFile: async () => {},
	});
const read = (project: Project, path: string) => readFileSync(join(project.root, path), "utf8");

describe("0.9.0 authz-stores codemod", () => {
	it.each([
		["prisma", "prismaAuthzStore(db)"],
		["drizzle", "drizzleAuthzStore(db, tables)"],
	] as const)("moves a %s app onto the package's store", async (orm, call) => {
		const project = app(orm);
		const report = await run(project);
		expect(report.removed).toEqual(["src/core/authz/db/store.ts"]);
		expect(read(project, "src/core/authz/index.ts")).toContain(call);
	});

	it("keeps a customised store, and tries again next upgrade", async () => {
		const project = app("prisma", {
			"src/core/authz/db/store.ts": "export const store = { mine: 1 };\n",
		});
		const report = await run(project);
		expect(existsSync(join(project.root, "src/core/authz/db/store.ts"))).toBe(true);
		expect(read(project, "src/core/authz/index.ts")).toBe(OLD["src/core/authz/index.ts"]);
		expect(report.blocked).toEqual(["authz-stores"]);
	});

	it("leaves an app that ejected authz alone", async () => {
		const project = app("prisma", {
			"tatara.json": JSON.stringify({
				...JSON.parse(readFileSync(join(app("prisma").root, "tatara.json"), "utf8")),
				ejected: { authz: "0.1.0" },
			}),
		});
		const report = await run(loadProject(project.root));
		expect(report.removed).toEqual([]);
		expect(report.notes.join("\n")).toContain("@tatara/authz is ejected");
	});

	it("keeps the store when other code imports it", async () => {
		const project = app("prisma", {
			"src/modules/x/services/x.ts": 'import { store } from "#core/authz/db/store";\n',
		});
		const report = await run(project);
		expect(report.removed).toEqual([]);
		expect(report.notes.join("\n")).toContain("src/modules/x/services/x.ts imports store");
	});
});
