import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { upgrade } from "../../commands/upgrade.ts";
import { loadProject, type Project } from "../../project/config.ts";
import { hashContent } from "../../project/hashes.ts";
import type { Baseline } from "../baseline.ts";
import { addonPackages } from "./addon-packages.ts";

const OLD: Record<string, string> = {
	"src/core/storage/index.ts": 'import { s3Storage } from "#core/storage/s3";\n// old\n',
	"src/core/storage/storage.ts": "export interface Storage {}\n",
	"src/core/storage/local.ts": "export function localStorage() {}\n",
	"src/core/storage/s3.ts": "export const s3 = 1;\n",
	"src/core/storage/commands/check.ts": "// old check\n",
	"src/core/storage/tests/storage.test.ts": "// old test\n",
	"src/core/email/send.ts": "export async function sendEmail() {}\n// old\n",
	"src/core/i18n/index.ts": "export function t() {}\n// old\n",
	"src/core/jobs/define.ts": "export function defineConsumer() {}\n",
	"src/core/jobs/process.ts": "export function processJob() {}\n",
	"src/core/jobs/lock.ts": "export function withLock() {}\n",
	"src/core/jobs/redis.ts": "export function redis() {}\n",
	"src/core/jobs/queue.ts": "export function enqueue() {}\n",
	"src/apps/worker/index.ts": "// old worker\n",
	"src/apps/cron/index.ts": "// old cron\n",
	"src/core/jobs/commands/enqueue.ts": "// old enqueue\n",
};

const CONSUMER = 'import { defineConsumer } from "#core/jobs/define";\n';
const SERVICE =
	'import { enqueue } from "#core/jobs/queue";\nimport type { Storage } from "#core/storage/storage";\n';

function app(
	overrides: Record<string, string> = {},
	addons = ["storage", "email", "i18n", "jobs"],
): Project {
	const root = mkdtempSync(join(tmpdir(), "tatara-addons-codemod-"));
	const files: Record<string, string> = {
		...OLD,
		"src/modules/users/consumers/welcome.ts": CONSUMER,
		"src/modules/users/services/users.ts": SERVICE,
		"package.json": JSON.stringify({ name: "app", dependencies: {}, devDependencies: {} }),
		"tatara.json": JSON.stringify({
			version: "0.6.0",
			name: "notes-app",
			orm: "none",
			database: "none",
			auth: "none",
			authMethods: [],
			addons,
			packageManager: "pnpm",
			generated: {
				cli: "0.6.0",
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
		cliVersion: "0.7.0",
		codemods: [addonPackages],
		baseline: recorded(project),
		runSync: async () => {},
		formatFile: async () => {},
	});
const read = (project: Project, path: string) => readFileSync(join(project.root, path), "utf8");
const exists = (project: Project, path: string) => existsSync(join(project.root, path));
const deps = (project: Project) => JSON.parse(read(project, "package.json")).dependencies;

describe("0.7.0 addon-packages codemod", () => {
	it("moves every add-on the app has onto its package", async () => {
		const project = app();
		const report = await run(project);
		// 8 copies, plus the storage framework test this CLI no longer puts in apps
		expect(report.removed).toHaveLength(9);
		expect(report.removed).toContain("src/core/storage/tests/storage.test.ts");
		for (const name of ["storage", "email", "i18n", "jobs"])
			expect(deps(project)[`@tatara/${name}`]).toMatch(/^\^0\./);
		expect(read(project, "src/core/storage/index.ts")).toContain("s3Storage({ client: s3");
		expect(read(project, "src/core/email/send.ts")).toContain("createMailer(");
		expect(read(project, "src/core/i18n/index.ts")).toContain("createI18n(");
		expect(read(project, "src/core/jobs/index.ts")).toContain("lazyRedis(env.REDIS_URL)");
		expect(read(project, "src/apps/worker/index.ts")).toContain("startWorker(");
		expect(read(project, "src/apps/cron/index.ts")).toContain("startCron(");
	});

	it("points module code at the package or the app's config", async () => {
		const project = app();
		await run(project);
		expect(read(project, "src/modules/users/consumers/welcome.ts")).toContain(
			'from "@tatara/jobs"',
		);
		const service = read(project, "src/modules/users/services/users.ts");
		expect(service).toContain('import { enqueue } from "#core/jobs/index"');
		expect(service).toContain('from "@tatara/storage"');
	});

	it("only touches the add-ons the app has", async () => {
		const project = app({}, ["email"]);
		const report = await run(project);
		expect(report.removed).toEqual([]);
		expect(read(project, "src/core/jobs/define.ts")).toBe(OLD["src/core/jobs/define.ts"]);
		expect(deps(project)["@tatara/jobs"]).toBeUndefined();
		expect(read(project, "src/core/email/send.ts")).toContain("createMailer(");
	});

	it("leaves a customised add-on alone and moves the others", async () => {
		const project = app({ "src/core/i18n/index.ts": "export function t() {}\n// + fr\n" });
		const report = await run(project);
		expect(read(project, "src/core/i18n/index.ts")).toContain("// + fr");
		expect(report.notes.join("\n")).toContain("i18n was not moved");
		// recorded below 0.7.0, so the next upgrade tries i18n again once it's moved by hand
		expect(report.blocked).toEqual(["addon-packages"]);
		expect(read(project, "src/core/email/send.ts")).toContain("createMailer(");
	});

	it("keeps jobs when a module uses withLock, whose arguments changed", async () => {
		const project = app({
			"src/modules/users/services/once.ts": 'import { withLock } from "#core/jobs/lock";\n',
		});
		const report = await run(project);
		expect(exists(project, "src/core/jobs/lock.ts")).toBe(true);
		expect(exists(project, "src/core/jobs/index.ts")).toBe(false);
		expect(read(project, "src/modules/users/consumers/welcome.ts")).toBe(CONSUMER);
		expect(report.notes.join("\n")).toContain("imports withLock from #core/jobs/lock");
	});

	it("does not bring back an example test the app deleted", async () => {
		const project = app();
		await run(project);
		expect(exists(project, "src/modules/example/tests/jobs.test.ts")).toBe(false);
	});

	it("is idempotent", async () => {
		const project = app();
		await run(project);
		const paths = [
			"src/core/storage/index.ts",
			"src/core/jobs/index.ts",
			"src/modules/users/services/users.ts",
		];
		const before = paths.map((p) => read(project, p));
		const again = loadProject(project.root);
		const report = await upgrade(
			{ ...again, config: { ...again.config, version: "0.6.0" } },
			{
				cliVersion: "0.7.0",
				codemods: [addonPackages],
				baseline: recorded(again),
				runSync: async () => {},
				formatFile: async () => {},
			},
		);
		expect(paths.map((p) => read(project, p))).toEqual(before);
		expect(report.notes).toEqual([]);
	});
});
