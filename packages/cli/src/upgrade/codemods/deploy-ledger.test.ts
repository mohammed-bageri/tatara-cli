import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { upgrade } from "../../commands/upgrade.ts";
import { loadProject, type Project } from "../../project/config.ts";
import { hashContent } from "../../project/hashes.ts";
import { deployLedger } from "./deploy-ledger.ts";

const OLD: Record<string, string> = {
	"src/apps/cli/index.ts": "// old cli\n",
	"src/core/config/env.ts": "export const env = {};\n",
	".env.example": "PORT=3000\n",
	".env.test": "PORT=3000\n",
};

function app(overrides: Record<string, string> = {}): Project {
	const root = mkdtempSync(join(tmpdir(), "tatara-deploy-ledger-"));
	const files: Record<string, string> = {
		...OLD,
		"package.json": JSON.stringify({ name: "app", dependencies: {}, devDependencies: {} }),
		"tatara.json": JSON.stringify({
			version: "0.10.0",
			name: "app",
			orm: "drizzle",
			database: "mysql",
			auth: "better-auth",
			authMethods: ["password"],
			addons: [],
			packageManager: "pnpm",
			generated: {
				cli: "0.10.0",
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
		cliVersion: "0.11.0",
		codemods: [deployLedger],
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

describe("0.11.0 deploy-ledger codemod", () => {
	it("gives the CLI the ledger and a MySQL app its ledger table", async () => {
		const project = app();
		const report = await run(project);
		expect(read(project, "src/apps/cli/index.ts")).toContain(
			"ledger: commandLedger(env.DATABASE_URL)",
		);
		expect(read(project, "src/core/commands/db/command-runs.schema.ts")).toContain(
			"tatara_command_runs",
		);
		expect(report.notes.join("\n")).toContain("tatara db generate --name command_runs");
	});

	it("leaves a customised CLI alone and says what changed", async () => {
		const project = app({ "src/apps/cli/index.ts": "// mine\n" });
		const report = await run(project);
		expect(read(project, "src/apps/cli/index.ts")).toBe("// mine\n");
		expect(report.notes.join("\n")).toContain("commandLedger");
	});
});
