import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { upgrade } from "../../commands/upgrade.ts";
import { loadProject, type Project } from "../../project/config.ts";
import { hashContent } from "../../project/hashes.ts";
import { jobsDrivers } from "./jobs-drivers.ts";

const OLD: Record<string, string> = {
	"src/core/jobs/index.ts": "export const enqueue = 1;\n",
	"src/apps/worker/index.ts": "// old worker\n",
	"src/apps/cron/index.ts": "// old cron\n",
};

function app(overrides: Record<string, string> = {}): Project {
	const root = mkdtempSync(join(tmpdir(), "tatara-jobs-drivers-"));
	const files: Record<string, string> = {
		...OLD,
		"package.json": JSON.stringify({ name: "app", dependencies: {}, devDependencies: {} }),
		"tatara.json": JSON.stringify({
			version: "0.10.0",
			name: "app",
			orm: "drizzle",
			database: "postgres",
			auth: "better-auth",
			authMethods: ["password"],
			addons: ["jobs"],
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
		codemods: [jobsDrivers],
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

describe("0.11.0 jobs-drivers codemod", () => {
	it("gives a jobs app the drivers, the schedule runner and the cache", async () => {
		const project = app();
		await run(project);
		expect(read(project, "src/core/jobs/index.ts")).toContain(
			"createJobs<TopicsOf<typeof consumers>>",
		);
		expect(read(project, "src/apps/worker/index.ts")).toContain("driver: jobs.driver");
		expect(read(project, "src/apps/cron/runner.ts")).toContain("lock: cache");
		expect(read(project, "src/core/jobs/outbox.ts")).toContain("inTransaction");
		expect(read(project, "src/core/cache/index.ts")).toContain("createCache");
		expect(JSON.parse(read(project, "tatara.json")).addons).toEqual(["jobs", "cache"]);
		const pkg = JSON.parse(read(project, "package.json"));
		expect(pkg.dependencies["@tatara/cache"]).toBeDefined();
		expect(pkg.dependencies.kafkajs).toBeDefined();
	});

	it("leaves a customised worker alone and says what changed", async () => {
		const project = app({ "src/apps/worker/index.ts": "// mine\n" });
		const report = await run(project);
		expect(read(project, "src/apps/worker/index.ts")).toBe("// mine\n");
		expect(report.notes.join("\n")).toContain("startWorker takes { driver: jobs.driver");
	});

	it("does nothing to an app without jobs", async () => {
		const project = app({
			"tatara.json": JSON.stringify({
				version: "0.10.0",
				name: "app",
				orm: "drizzle",
				database: "postgres",
				auth: "none",
				authMethods: [],
				addons: [],
				packageManager: "pnpm",
				generated: { cli: "0.10.0", files: {} },
			}),
		});
		const report = await run(project);
		expect(report.notes).toEqual([]);
		expect(read(project, "src/apps/worker/index.ts")).toBe("// old worker\n");
	});
});
