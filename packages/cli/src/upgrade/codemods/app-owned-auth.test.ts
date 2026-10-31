import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { upgrade } from "../../commands/upgrade.ts";
import { loadProject, type Project } from "../../project/config.ts";
import { hashContent } from "../../project/hashes.ts";
import { appOwnedAuth } from "./app-owned-auth.ts";

const OLD: Record<string, string> = {
	"src/core/http/app.ts": 'import { auth } from "#core/auth/auth";\n// old app\n',
	"src/core/auth/auth.ts": "export const auth = {};\n// old auth\n",
	"src/core/auth/principal.ts": "export const attachPrincipal = 1;\n",
	"src/core/auth/adapter.ts": "export const database = 1;\n",
	"src/core/auth/delivery.ts": "export async function deliverEmail() {}\n",
	"src/core/auth/sms.ts": "export const smsSender = 1;\n",
	"src/core/auth/db/seed.ts": "export default {};\n",
	"src/core/auth/routes/me.routes.ts": "export default {};\n",
	"src/core/authz/routes/authorization.routes.ts": "export default {};\n",
	"src/core/authz/index.ts": "export const authz = createAuthz<PermissionKey>({\n\tstore,\n});\n",
};

function app(
	overrides: Record<string, string> = {},
	authMethods: string[] = ["password"],
): Project {
	const root = mkdtempSync(join(tmpdir(), "tatara-app-owned-auth-"));
	const files: Record<string, string> = {
		...OLD,
		"src/apps/api/app.ts": 'import { createHttpApp } from "#core/http/app";\n',
		"src/modules/notes/services/notes.ts": 'import { auth } from "#core/auth/auth";\n',
		"tests/helpers/send.ts": 'import { deliverEmail } from "#core/auth/delivery";\n',
		"package.json": JSON.stringify({ name: "app", dependencies: {}, devDependencies: {} }),
		"tatara.json": JSON.stringify({
			version: "0.9.2",
			name: "app",
			orm: "prisma",
			database: "postgres",
			auth: "better-auth",
			authMethods,
			addons: ["authz"],
			packageManager: "pnpm",
			generated: {
				cli: "0.9.2",
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
		cliVersion: "0.10.0",
		codemods: [appOwnedAuth],
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
const exists = (project: Project, path: string) => existsSync(join(project.root, path));

describe("0.10.0 app-owned-auth codemod", () => {
	it("moves auth into the users module and HTTP wiring into apps", async () => {
		const project = app();
		const report = await run(project);
		expect(read(project, "src/modules/users/services/auth.ts")).toContain("createAuthInstance(");
		expect(read(project, "src/apps/http.ts")).toContain("attachPrincipal");
		expect(read(project, "src/modules/users/routes/authorization.routes.ts")).toContain(
			"authorizationRoutes<AppEnv>(authz",
		);
		for (const old of Object.keys(OLD).filter((p) => p !== "src/core/authz/index.ts"))
			expect(exists(project, old), old).toBe(false);
		expect(report.blocked).toEqual([]);
	});

	it("points every importer at the new places", async () => {
		const project = app();
		await run(project);
		expect(read(project, "src/apps/api/app.ts")).toContain('from "#apps/http"');
		expect(read(project, "src/modules/notes/services/notes.ts")).toContain(
			'from "#modules/users/services/auth"',
		);
		expect(read(project, "tests/helpers/send.ts")).toContain(
			'from "#modules/users/services/delivery"',
		);
	});

	it("moves nothing when auth.ts is customised, and tries again next upgrade", async () => {
		const project = app({ "src/core/auth/auth.ts": "export const auth = { mine: true };\n" });
		const report = await run(project);
		expect(read(project, "src/core/auth/auth.ts")).toContain("mine");
		expect(exists(project, "src/modules/users/services/auth.ts")).toBe(false);
		expect(exists(project, "src/core/http/app.ts")).toBe(true);
		expect(report.blocked).toEqual(["app-owned-auth"]);
		expect(report.notes.join("\n")).toContain("src/core/auth/auth.ts is customised");
	});

	it("keeps a customised authz instance single-tenant even when blocked", async () => {
		const custom = "export const authz = createAuthz<PermissionKey>({\n\tstore,\n\tmine: 1,\n});\n";
		const project = app({
			"src/core/authz/index.ts": custom,
			"src/core/auth/auth.ts": "export const auth = { mine: true };\n",
		});
		await run(project);
		expect(read(project, "src/core/authz/index.ts")).toContain('singleTenant: "default"');
	});

	it("leaves an app with organizations without a single tenant", async () => {
		const project = app({}, ["password", "orgs"]);
		await run(project);
		expect(read(project, "src/core/authz/index.ts")).not.toContain("singleTenant");
	});

	it("names the app's own files left in src/core/auth", async () => {
		const project = app({ "src/core/auth/guest-link.ts": "export const x = 1;\n" });
		const report = await run(project);
		expect(report.notes.join("\n")).toContain("src/core/auth/guest-link.ts");
	});

	it("is idempotent", async () => {
		const project = app();
		await run(project);
		const before = read(project, "src/modules/users/services/auth.ts");
		const again = loadProject(project.root);
		const report = await upgrade(
			{ ...again, config: { ...again.config, version: "0.9.2" } },
			{
				cliVersion: "0.10.0",
				codemods: [appOwnedAuth],
				baseline: {
					async isUnchanged(path, content) {
						return again.config.generated?.files[path] === hashContent(content);
					},
				},
				runSync: async () => {},
				runInstall: async () => {},
				formatFile: async () => {},
			},
		);
		expect(read(project, "src/modules/users/services/auth.ts")).toBe(before);
		expect(report.blocked).toEqual([]);
	});
});
