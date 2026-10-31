import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { upgrade } from "../../commands/upgrade.ts";
import { loadProject, type Project } from "../../project/config.ts";
import { hashContent } from "../../project/hashes.ts";
import type { Baseline } from "../baseline.ts";
import { corePackage } from "./core-package.ts";

const ENV_011 = `import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const production = process.env.NODE_ENV === "production";

/** A default for local development; production must set the value explicitly. */
function localDefault<T extends z.ZodType>(schema: T, value: z.input<T>): T {
	return production ? schema : (schema.default(value as never) as unknown as T);
}

/** The only place that reads process.env. Add new variables here and to .env.example. */
export const env = createEnv({
	server: {
		APP_URL: localDefault(z.url(), "http://localhost:3000"),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
`;

const CLI_011 = `import { runCommand } from "#core/commands/runner";
import { shutdown } from "#core/process/lifecycle";
import { commands } from "#generated/commands";

const code = await runCommand(commands, process.argv.slice(2));
await shutdown(code);
`;

const SERVER_011 = `import { logger } from "#core/logging/logger";
import { handleSignals, onShutdown } from "#core/process/lifecycle";

export function startServer() {
	onShutdown("http", () => {});
	handleSignals();
}
`;

const LOGGER_011 = `import { pino } from "pino";
import { env } from "#core/config/env";

export const logger = pino({ level: env.LOG_LEVEL, base: { service: "app" } });

export type Logger = typeof logger;
`;

const GENERATED: Record<string, string> = {
	"src/core/commands/define.ts": "export function defineCommand() {}\n",
	// imports define, as the real runner does: removals must be decided before imports change
	"src/core/commands/runner.ts":
		'import type { CommandDefinition } from "#core/commands/define";\nexport function runCommand() {}\n',
	"src/core/process/lifecycle.ts": "export function onShutdown() {}\n",
	"src/core/http/health.ts": "export function registerReadinessCheck() {}\n",
	"src/apps/cli/index.ts": CLI_011,
	"src/core/http/server.ts": SERVER_011,
	"src/core/logging/logger.ts": LOGGER_011,
};

function app(overrides: Record<string, string> = {}): Project {
	const root = mkdtempSync(join(tmpdir(), "tatara-core-codemod-"));
	const files: Record<string, string> = {
		...GENERATED,
		"src/core/config/env.ts": ENV_011,
		"src/modules/x/commands/x.ts": 'import { defineCommand } from "#core/commands/define";\n',
		"src/core/db/client.ts":
			'import { registerReadinessCheck } from "#core/http/health";\nimport { onShutdown } from "#core/process/lifecycle";\n',
		"package.json": JSON.stringify({ name: "app", dependencies: {}, devDependencies: {} }),
		"tatara.json": JSON.stringify({
			version: "0.1.3",
			name: "app",
			orm: "none",
			database: "none",
			auth: "none",
			authMethods: [],
			addons: [],
			packageManager: "pnpm",
			generated: {
				cli: "0.1.3",
				files: Object.fromEntries(Object.entries(GENERATED).map(([p, t]) => [p, hashContent(t)])),
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

async function run(project: Project) {
	return upgrade(project, {
		cliVersion: "0.2.0",
		codemods: [corePackage],
		baseline: recorded(project),
		runSync: async () => {},
		runInstall: async () => {},
		formatFile: async () => {},
	});
}

const read = (project: Project, path: string) => readFileSync(join(project.root, path), "utf8");

describe("0.2.0 core-package codemod", () => {
	it("adds @tatara/core and removes unchanged copies", async () => {
		const project = app();
		const report = await run(project);
		expect(report.removed.sort()).toEqual([
			"src/core/commands/define.ts",
			"src/core/commands/runner.ts",
			"src/core/http/health.ts",
			"src/core/process/lifecycle.ts",
		]);
		expect(JSON.parse(read(project, "package.json")).dependencies["@tatara/core"]).toMatch(
			/^\^0\./,
		);
		expect(read(project, "src/modules/x/commands/x.ts")).toContain('from "@tatara/core"');
		expect(read(project, "src/core/db/client.ts")).not.toContain("#core/");
	});

	it("rewrites the env.ts helper", async () => {
		const project = app();
		await run(project);
		const env = read(project, "src/core/config/env.ts");
		expect(env).toContain('import { createLocalDefault } from "@tatara/core";');
		expect(env).toContain(
			'const localDefault = createLocalDefault(process.env.NODE_ENV === "production");',
		);
		expect(env).not.toContain("function localDefault");
		expect(env).toContain('APP_URL: localDefault(z.url(), "http://localhost:3000")');
	});

	it("passes the logger to handleSignals, runCommand and shutdown", async () => {
		const project = app();
		await run(project);
		const cli = read(project, "src/apps/cli/index.ts");
		expect(cli).toContain("runCommand(commands, process.argv.slice(2), logger)");
		expect(cli).toContain("shutdown(code, logger)");
		expect(cli).toContain('import { logger } from "#core/logging/logger";');
		expect(read(project, "src/core/http/server.ts")).toContain("handleSignals(logger);");
	});

	it("uses loggerOptions in an unchanged logger", async () => {
		const project = app();
		await run(project);
		const logger = read(project, "src/core/logging/logger.ts");
		expect(logger).toContain('import { loggerOptions } from "@tatara/core";');
		expect(logger).toContain('service: "app"');
	});

	it("keeps a customised logger", async () => {
		const custom =
			'import { pino } from "pino";\nexport const logger = pino({ messageKey: "message" });\n';
		const project = app({ "src/core/logging/logger.ts": custom });
		const report = await run(project);
		expect(read(project, "src/core/logging/logger.ts")).toBe(custom);
		expect(report.notes.join("\n")).toContain("src/core/logging/logger.ts");
	});

	it("is idempotent", async () => {
		const project = app();
		await run(project);
		const snapshot = [
			"src/core/config/env.ts",
			"src/apps/cli/index.ts",
			"src/core/http/server.ts",
		].map((p) => read(project, p));
		const again = loadProject(project.root);
		await upgrade(again, {
			cliVersion: "0.2.0",
			codemods: [{ ...corePackage, version: "0.2.0" }],
			baseline: recorded(again),
			runSync: async () => {},
			runInstall: async () => {},
			formatFile: async () => {},
		});
		// re-running the codemod itself (as after a failed sync) changes nothing either
		const ctxRun = await upgrade(
			{ ...again, config: { ...again.config, version: "0.1.3" } },
			{
				cliVersion: "0.2.0",
				codemods: [corePackage],
				baseline: recorded(again),
				runSync: async () => {},
				runInstall: async () => {},
				formatFile: async () => {},
			},
		);
		expect(ctxRun.removed).toEqual([]);
		expect(
			["src/core/config/env.ts", "src/apps/cli/index.ts", "src/core/http/server.ts"].map((p) =>
				read(project, p),
			),
		).toEqual(snapshot);
	});

	it("lets pnpm install @tatara/* releases right away", async () => {
		const project = app({
			"pnpm-workspace.yaml":
				"allowBuilds:\n  esbuild: true\nminimumReleaseAgeExclude:\n  - '@tatara/cli@0.1.0'\n",
		});
		await run(project);
		const workspace = read(project, "pnpm-workspace.yaml");
		expect(workspace).toContain('  - "@tatara/*"');
		expect(workspace).toContain("  - '@tatara/cli@0.1.0'");
		await run(loadProject(project.root));
		expect(read(project, "pnpm-workspace.yaml").match(/@tatara\/\*/g)).toHaveLength(1);
	});

	it("adds the exclusion when the workspace file has none", async () => {
		const project = app({ "pnpm-workspace.yaml": "allowBuilds:\n  esbuild: true\n" });
		await run(project);
		expect(read(project, "pnpm-workspace.yaml")).toContain(
			'minimumReleaseAgeExclude:\n  - "@tatara/*"',
		);
	});

	it("leaves call sites alone when the local lifecycle is kept", async () => {
		const project = app({
			"src/core/process/lifecycle.ts": "export function onShutdown() {} // mine\n",
		});
		await run(project);
		expect(read(project, "src/core/http/server.ts")).toContain("handleSignals();");
		const cli = read(project, "src/apps/cli/index.ts");
		expect(cli).toContain("await shutdown(code);");
		expect(cli).toContain("runCommand(commands, process.argv.slice(2), logger)");
	});

	it("warns that production log fields change", async () => {
		const project = app();
		const report = await run(project);
		expect(report.notes.join("\n")).toMatch(/`message` \(was `msg`\)/);
	});
});
