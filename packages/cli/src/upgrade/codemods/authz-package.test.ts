import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { upgrade } from "../../commands/upgrade.ts";
import { loadProject, type Project } from "../../project/config.ts";
import { hashContent } from "../../project/hashes.ts";
import type { Baseline } from "../baseline.ts";
import { authzPackage } from "./authz-package.ts";

const D = "src/core/authz";
const OLD: Record<string, string> = Object.fromEntries(
	[
		"cache.ts",
		"catalog.ts",
		"constants.ts",
		"middleware.ts",
		"permissions.ts",
		"resolver.ts",
		"types.ts",
		"validators.ts",
		"services/audit.ts",
		"services/grants.ts",
		"services/members.ts",
		"services/roles.ts",
		"services/sync.ts",
		"db/seed.ts",
		"commands/grant-role.ts",
		"commands/sync-permissions.ts",
		"routes/authorization.routes.ts",
		"tests/authz.test.ts",
	]
		.map((f): [string, string] => [`${D}/${f}`, `// old ${f}\n`])
		.concat([["tests/helpers/authz.ts", "// old helper\n"]]),
);

const STORE =
	'import type { AuthzStore } from "#core/authz/types";\nimport { SYSTEM_ORG_ID } from "#core/authz/constants";\n';
const AUTH = 'import { removeMemberAccess } from "#core/authz/services/members";\n';
const MODULE_ROUTE = 'import { requirePermission } from "#core/authz/middleware";\n';
const MODULE_PERMS = 'import { definePermissions } from "#core/authz/catalog";\n';
const SERVICE = 'import { resolveScope } from "#core/authz/resolver";\n';

function app(overrides: Record<string, string> = {}, addons = ["authz"]): Project {
	const root = mkdtempSync(join(tmpdir(), "tatara-authz-codemod-"));
	const files: Record<string, string> = {
		...OLD,
		[`${D}/system-roles.ts`]: "export const SYSTEM_ROLES = [];\n// mine\n",
		[`${D}/db/store.ts`]: STORE,
		"src/core/auth/auth.ts": AUTH,
		"src/modules/docs/routes/docs.routes.ts": MODULE_ROUTE,
		"src/modules/docs/permissions/docs.permissions.ts": MODULE_PERMS,
		"src/modules/docs/services/docs.ts": SERVICE,
		"package.json": JSON.stringify({ name: "app", dependencies: {}, devDependencies: {} }),
		"tatara.json": JSON.stringify({
			version: "0.5.0",
			name: "notes-app",
			orm: "prisma",
			database: "postgres",
			auth: "better-auth",
			authMethods: ["password", "orgs"],
			addons,
			packageManager: "pnpm",
			generated: {
				cli: "0.5.0",
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
		cliVersion: "0.6.0",
		codemods: [authzPackage],
		baseline: recorded(project),
		runSync: async () => {},
		formatFile: async () => {},
	});
const read = (project: Project, path: string) => readFileSync(join(project.root, path), "utf8");
const exists = (project: Project, path: string) => existsSync(join(project.root, path));

describe("0.6.0 authz-package codemod", () => {
	it("adds @tatara/authz, removes the copies and writes the app's createAuthz", async () => {
		const project = app();
		const report = await run(project);
		expect(report.removed).toHaveLength(13);
		expect(exists(project, `${D}/resolver.ts`)).toBe(false);
		expect(read(project, `${D}/index.ts`)).toContain("createAuthz<PermissionKey>(");
		expect(read(project, `${D}/routes/authorization.routes.ts`)).toContain(
			"authorizationRoutes<AppEnv>(authz)",
		);
		expect(read(project, "tests/helpers/authz.ts")).toContain("authz.addOverlay(");
		expect(JSON.parse(read(project, "package.json")).dependencies["@tatara/authz"]).toMatch(
			/^\^0\./,
		);
	});

	it("points other files at the package or the app's authz", async () => {
		const project = app();
		await run(project);
		expect(read(project, `${D}/db/store.ts`)).not.toContain("#core/authz/");
		expect(read(project, `${D}/db/store.ts`)).toContain('from "@tatara/authz"');
		expect(read(project, "src/core/auth/auth.ts")).toContain('from "#core/authz/index"');
		expect(read(project, "src/modules/docs/routes/docs.routes.ts")).toContain(
			'from "#core/authz/index"',
		);
		expect(read(project, "src/modules/docs/services/docs.ts")).toContain(
			'from "#core/authz/index"',
		);
		expect(read(project, "src/modules/docs/permissions/docs.permissions.ts")).toContain(
			'from "@tatara/authz"',
		);
	});

	it("keeps the app's system roles", async () => {
		const project = app();
		await run(project);
		expect(read(project, `${D}/system-roles.ts`)).toContain("// mine");
	});

	it("changes nothing when a moved file is customised, and says why", async () => {
		const project = app({ [`${D}/resolver.ts`]: "// mine\n" });
		const report = await run(project);
		expect(report.removed).toEqual([]);
		expect(exists(project, `${D}/index.ts`)).toBe(false);
		expect(read(project, "src/modules/docs/routes/docs.routes.ts")).toBe(MODULE_ROUTE);
		expect(report.blocked).toEqual(["authz-package"]);
		expect(report.notes.join("\n")).toContain(`${D}/resolver.ts is customised`);
	});

	it("changes nothing when another file imports a name with no new home", async () => {
		const project = app({
			"src/modules/docs/services/cached.ts": 'import { invalidateAll } from "#core/authz/cache";\n',
		});
		const report = await run(project);
		expect(report.removed).toEqual([]);
		expect(report.notes.join("\n")).toContain(
			"src/modules/docs/services/cached.ts imports invalidateAll",
		);
	});

	it("does nothing without authz", async () => {
		const project = app({}, []);
		const report = await run(project);
		expect(report.removed).toEqual([]);
		expect(JSON.parse(read(project, "package.json")).dependencies["@tatara/authz"]).toBeUndefined();
	});

	it("is idempotent", async () => {
		const project = app();
		await run(project);
		const paths = [`${D}/index.ts`, `${D}/db/store.ts`, "src/core/auth/auth.ts"];
		const before = paths.map((p) => read(project, p));
		const again = loadProject(project.root);
		const report = await upgrade(
			{ ...again, config: { ...again.config, version: "0.5.0" } },
			{
				cliVersion: "0.6.0",
				codemods: [authzPackage],
				baseline: recorded(again),
				runSync: async () => {},
				formatFile: async () => {},
			},
		);
		expect(paths.map((p) => read(project, p))).toEqual(before);
		expect(report.notes).toEqual([]);
	});
});
