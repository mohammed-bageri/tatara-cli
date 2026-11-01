import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { upgrade } from "../../commands/upgrade.ts";
import { loadProject, type Project } from "../../project/config.ts";
import { hashContent } from "../../project/hashes.ts";
import type { Baseline } from "../baseline.ts";
import { httpPackage } from "./http-package.ts";

const OLD: Record<string, string> = {
	"src/core/http/errors.ts": "export class AppError extends Error {}\n",
	"src/core/http/response.ts": "export function success() {}\n",
	"src/core/http/server.ts": "export function startServer() {}\n",
	"src/core/http/middleware/error-handler.ts": 'import { AppError } from "#core/http/errors";\n',
	"src/core/http/middleware/request-context.ts": "export const requestContext = 1;\n",
	"src/core/http/middleware/validation.ts":
		'import { ValidationError } from "#core/http/errors";\n',
	"src/core/http/app.ts":
		'import { errorHandler } from "#core/http/middleware/error-handler";\n// old app\n',
	"src/core/http/routes.ts":
		'import { validationHook } from "#core/http/middleware/validation";\n// old routes\n',
	"src/apps/api/server.ts": 'import { startServer } from "#core/http/server";\n// old server\n',
};

function app(overrides: Record<string, string> = {}): Project {
	const root = mkdtempSync(join(tmpdir(), "tatara-http-codemod-"));
	const files: Record<string, string> = {
		...OLD,
		"src/modules/notes/services/notes.ts": 'import { NotFoundError } from "#core/http/errors";\n',
		"src/modules/notes/routes/notes.routes.ts": 'import { success } from "#core/http/response";\n',
		"package.json": JSON.stringify({ name: "app", dependencies: {}, devDependencies: {} }),
		"tatara.json": JSON.stringify({
			version: "0.2.0",
			name: "notes-app",
			orm: "none",
			database: "none",
			auth: "none",
			authMethods: [],
			addons: [],
			packageManager: "pnpm",
			generated: {
				cli: "0.2.0",
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
		cliVersion: "0.3.0",
		codemods: [httpPackage],
		baseline: recorded(project),
		runSync: async () => {},
		runInstall: async () => {},
		formatFile: async () => {},
	});
const read = (project: Project, path: string) => readFileSync(join(project.root, path), "utf8");

describe("0.3.0 http-package codemod", () => {
	it("adds @tatara/http, removes the copies and rewrites imports", async () => {
		const project = app();
		const report = await run(project);
		expect(report.removed.sort()).toEqual([
			"src/core/http/errors.ts",
			"src/core/http/middleware/error-handler.ts",
			"src/core/http/middleware/request-context.ts",
			"src/core/http/middleware/validation.ts",
			"src/core/http/response.ts",
			"src/core/http/server.ts",
		]);
		expect(JSON.parse(read(project, "package.json")).dependencies["@tatara/http"]).toMatch(
			/^\^0\./,
		);
		expect(read(project, "src/modules/notes/services/notes.ts")).toContain('from "@tatara/http"');
		expect(read(project, "src/modules/notes/routes/notes.routes.ts")).toContain(
			'from "@tatara/http"',
		);
	});

	it("replaces unchanged wiring with what this CLI generates", async () => {
		const project = app();
		await run(project);
		const appTs = read(project, "src/core/http/app.ts");
		expect(appTs).toContain('from "@tatara/http"');
		expect(appTs).toContain("createApp<AppEnv>");
		expect(read(project, "src/core/http/routes.ts")).toContain("createTataraRouter<AppEnv>()");
		const server = read(project, "src/apps/api/server.ts");
		expect(server).toContain("startServer(app, {");
		expect(server).toContain('name: "api"');
		expect(server).toContain('from "@tatara/http"');
	});

	it("changes nothing in the group when app.ts is customised, and says why", async () => {
		const custom = 'import { errorHandler } from "#core/http/middleware/error-handler";\n// mine\n';
		const project = app({ "src/core/http/app.ts": custom });
		const report = await run(project);
		expect(read(project, "src/core/http/app.ts")).toBe(custom);
		expect(report.removed).toEqual([]);
		expect(read(project, "src/modules/notes/services/notes.ts")).toContain('"#core/http/errors"');
		expect(report.blocked).toEqual(["http-package"]);
		expect(report.notes.join("\n")).toContain("src/core/http/app.ts");
	});

	it("changes nothing when errors.ts is customised (its classes would not match the package's)", async () => {
		const project = app({
			"src/core/http/errors.ts": "export class AppError extends Error {}\nexport class Mine {}\n",
		});
		const report = await run(project);
		expect(report.removed).toEqual([]);
		expect(read(project, "src/core/http/app.ts")).toBe(OLD["src/core/http/app.ts"]);
		expect(report.notes.join("\n")).toContain("src/core/http/errors.ts");
	});

	it("changes nothing when something else imports a moved file", async () => {
		const project = app({
			"tests/helpers/boot.ts": 'import { startServer } from "#core/http/server";\n',
		});
		const report = await run(project);
		expect(report.removed).toEqual([]);
		expect(report.notes.join("\n")).toContain("tests/helpers/boot.ts");
	});

	it("is idempotent", async () => {
		const project = app();
		await run(project);
		const before = ["src/core/http/app.ts", "src/core/http/routes.ts"].map((p) => read(project, p));
		const again = loadProject(project.root);
		await upgrade(
			{ ...again, config: { ...again.config, version: "0.2.0" } },
			{
				cliVersion: "0.3.0",
				codemods: [httpPackage],
				baseline: recorded(again),
				runSync: async () => {},
				runInstall: async () => {},
				formatFile: async () => {},
			},
		);
		expect(
			["src/core/http/app.ts", "src/core/http/routes.ts"].map((p) => read(project, p)),
		).toEqual(before);
	});
});
