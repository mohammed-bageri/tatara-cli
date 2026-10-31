import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { upgrade } from "../../commands/upgrade.ts";
import { loadProject, type Project } from "../../project/config.ts";
import { hashContent } from "../../project/hashes.ts";
import type { Baseline } from "../baseline.ts";
import { authPackage } from "./auth-package.ts";

const OLD: Record<string, string> = {
	"src/core/auth/middleware.ts": "export function requireAuth() {}\n",
	"src/core/auth/openapi.ts": "export async function mergeAuthOpenApi() {}\n",
	"src/core/auth/delivery.ts": "export function outboxEnabled() {}\n// old delivery\n",
	"src/core/auth/sms.ts": "export interface SmsSender {}\n// old sms\n",
	"src/core/auth/principal.ts": "export const attachPrincipal = 1;\n// old principal\n",
	"src/core/http/app.ts": 'import { mergeAuthOpenApi } from "#core/auth/openapi";\n// old app\n',
	"tests/helpers/auth.ts": "export async function asUser() {}\n// old helpers\n",
};

const KEYCLOAK_OLD: Record<string, string> = {
	"src/core/auth/auth.ts":
		'import { keycloakTokens } from "#core/auth/keycloak-plugin";\n// old auth\n',
	"src/core/auth/keycloak.ts": "export const issuer = 1;\n// old keycloak\n",
	"src/core/auth/keycloak-plugin.ts": "export function keycloakTokens() {}\n",
	"src/core/auth/commands/keycloak-token.ts":
		'import { issuer } from "#core/auth/keycloak";\n// old command\n',
	"src/core/auth/tests/keycloak-tokens.test.ts":
		'import { issuer } from "#core/auth/keycloak";\n// old test\n',
};

function app(
	options: { keycloak?: boolean; auth?: "better-auth" | "none" } = {},
	overrides: Record<string, string> = {},
): Project {
	const root = mkdtempSync(join(tmpdir(), "tatara-auth-codemod-"));
	const generated = { ...OLD, ...(options.keycloak ? KEYCLOAK_OLD : {}) };
	const files: Record<string, string> = {
		...generated,
		"src/modules/notes/routes/notes.routes.ts":
			'import { requireAuth } from "#core/auth/middleware";\n',
		"package.json": JSON.stringify({ name: "app", dependencies: {}, devDependencies: {} }),
		"tatara.json": JSON.stringify({
			version: "0.4.0",
			name: "notes-app",
			orm: "drizzle",
			database: "postgres",
			auth: options.auth ?? "better-auth",
			authMethods: options.keycloak ? ["keycloak"] : ["password"],
			addons: [],
			packageManager: "pnpm",
			generated: {
				cli: "0.4.0",
				files: Object.fromEntries(Object.entries(generated).map(([p, t]) => [p, hashContent(t)])),
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
		cliVersion: "0.5.0",
		codemods: [authPackage],
		baseline: recorded(project),
		runSync: async () => {},
		runInstall: async () => {},
		formatFile: async () => {},
	});
const read = (project: Project, path: string) => readFileSync(join(project.root, path), "utf8");
const exists = (project: Project, path: string) => existsSync(join(project.root, path));
const deps = (project: Project) => JSON.parse(read(project, "package.json")).dependencies;

describe("0.5.0 auth-package codemod", () => {
	it("adds @tatara/auth, removes the copies and rewrites guard imports", async () => {
		const project = app();
		const report = await run(project);
		expect(report.removed.sort()).toEqual([
			"src/core/auth/middleware.ts",
			"src/core/auth/openapi.ts",
		]);
		expect(deps(project)["@tatara/auth"]).toMatch(/^\^0\./);
		expect(deps(project)["@tatara/keycloak"]).toBeUndefined();
		expect(read(project, "src/modules/notes/routes/notes.routes.ts")).toContain(
			'from "@tatara/auth"',
		);
	});

	it("replaces unchanged wiring with what this CLI generates", async () => {
		const project = app();
		await run(project);
		expect(read(project, "src/core/http/app.ts")).toContain(
			"mergeAuthOpenApi(document, auth, `${API_PREFIX}/auth`)",
		);
		expect(read(project, "src/core/auth/delivery.ts")).toContain("createOutbox(");
		expect(read(project, "src/core/auth/sms.ts")).toContain("consoleSmsSender(logger)");
		expect(read(project, "src/core/auth/principal.ts")).toContain("sessionPrincipal(auth,");
		expect(read(project, "tests/helpers/auth.ts")).toContain('from "@tatara/auth/testing"');
	});

	it("keeps the OpenAPI/outbox group together when app.ts is customised", async () => {
		const custom = 'import { mergeAuthOpenApi } from "#core/auth/openapi";\n// mine\n';
		const project = app({}, { "src/core/http/app.ts": custom });
		const report = await run(project);
		expect(read(project, "src/core/http/app.ts")).toBe(custom);
		expect(exists(project, "src/core/auth/openapi.ts")).toBe(true);
		expect(read(project, "src/core/auth/delivery.ts")).toBe(OLD["src/core/auth/delivery.ts"]);
		expect(report.notes.join("\n")).toContain("src/core/http/app.ts is customised");
		// the other groups still move
		expect(read(project, "src/core/auth/principal.ts")).toContain("sessionPrincipal(auth,");
		expect(report.removed).toContain("src/core/auth/middleware.ts");
	});

	it("leaves a group alone when another file imports a name that goes away", async () => {
		const project = app(
			{},
			{ "src/modules/dev/outbox.ts": 'import { readOutbox } from "#core/auth/delivery";\n' },
		);
		const report = await run(project);
		expect(read(project, "src/core/auth/delivery.ts")).toBe(OLD["src/core/auth/delivery.ts"]);
		expect(report.notes.join("\n")).toContain("src/modules/dev/outbox.ts imports what moves");
	});

	it("does not count names that stay", async () => {
		const project = app(
			{},
			{ "src/modules/dev/mail.ts": 'import { deliverEmail } from "#core/auth/delivery";\n' },
		);
		await run(project);
		expect(read(project, "src/core/auth/delivery.ts")).toContain("createOutbox(");
	});

	it("moves Keycloak apps onto @tatara/keycloak", async () => {
		const project = app({ keycloak: true });
		const report = await run(project);
		expect(deps(project)["@tatara/keycloak"]).toMatch(/^\^0\./);
		expect(report.removed).toContain("src/core/auth/keycloak-plugin.ts");
		expect(read(project, "src/core/auth/keycloak.ts")).toContain("keycloakVerifier(");
		expect(read(project, "src/core/auth/auth.ts")).toContain('from "@tatara/keycloak"');
		expect(read(project, "src/core/auth/commands/keycloak-token.ts")).toContain("keycloak.issuer");
		expect(read(project, "tests/helpers/auth.ts")).toContain("useTestKeys(keycloak)");
		expect(read(project, "src/core/auth/principal.ts")).toContain("keycloakPrincipal(auth,");
	});

	it("keeps the Keycloak group when auth.ts is customised", async () => {
		const custom = 'import { keycloakTokens } from "#core/auth/keycloak-plugin";\n// mine\n';
		const project = app({ keycloak: true }, { "src/core/auth/auth.ts": custom });
		const report = await run(project);
		expect(exists(project, "src/core/auth/keycloak-plugin.ts")).toBe(true);
		expect(read(project, "src/core/auth/keycloak.ts")).toBe(
			KEYCLOAK_OLD["src/core/auth/keycloak.ts"],
		);
		expect(read(project, "tests/helpers/auth.ts")).toBe(OLD["tests/helpers/auth.ts"]);
		expect(report.notes.join("\n")).toContain("Keycloak was not moved");
	});

	it("does nothing without auth", async () => {
		const project = app({ auth: "none" });
		const report = await run(project);
		expect(report.removed).toEqual([]);
		expect(deps(project)["@tatara/auth"]).toBeUndefined();
	});

	it("is idempotent", async () => {
		const project = app({ keycloak: true });
		await run(project);
		const paths = ["src/core/http/app.ts", "src/core/auth/principal.ts", "tests/helpers/auth.ts"];
		const before = paths.map((p) => read(project, p));
		const again = loadProject(project.root);
		await upgrade(
			{ ...again, config: { ...again.config, version: "0.4.0" } },
			{
				cliVersion: "0.5.0",
				codemods: [authPackage],
				baseline: recorded(again),
				runSync: async () => {},
				runInstall: async () => {},
				formatFile: async () => {},
			},
		);
		expect(paths.map((p) => read(project, p))).toEqual(before);
	});
});
