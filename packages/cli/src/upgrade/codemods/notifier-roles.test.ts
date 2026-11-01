import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { upgrade } from "../../commands/upgrade.ts";
import { loadProject, type Project } from "../../project/config.ts";
import { hashContent } from "../../project/hashes.ts";
import { notifierRoles } from "./notifier-roles.ts";

const NOTIFIER = "src/modules/notifications/services/notifier.ts";
const TEST = "src/modules/notifications/tests/role-recipients.test.ts";
const OLD = "// old notifier: role() matches member.role\n";

function app(notifier: string, addons = ["authz", "jobs", "notifications"]): Project {
	const root = mkdtempSync(join(tmpdir(), "tatara-notifier-roles-"));
	const files: Record<string, string> = {
		[NOTIFIER]: notifier,
		"package.json": JSON.stringify({ name: "app", dependencies: {}, devDependencies: {} }),
		"tatara.json": JSON.stringify({
			version: "0.13.0",
			name: "app",
			orm: "prisma",
			database: "postgres",
			auth: "better-auth",
			authMethods: ["password", "orgs"],
			addons,
			packageManager: "pnpm",
			generated: { cli: "0.13.0", files: { [NOTIFIER]: hashContent(OLD) } },
		}),
	};
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	return loadProject(root);
}

const run = (project: Project) =>
	upgrade(project, {
		cliVersion: "0.13.1",
		codemods: [notifierRoles],
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

describe("0.13.1 notifier-roles codemod", () => {
	it("regenerates an untouched notifier to read authz roles, and adds its test", async () => {
		const project = app(OLD);
		await run(project);
		expect(read(project, NOTIFIER)).toContain(
			"authz.effectivePermissions(who)).roles.includes(role)",
		);
		expect(read(project, TEST)).toContain('to: { role: "admin" }');
	});

	it("leaves a customised notifier alone and says what to change", async () => {
		const project = app("// mine\n");
		const report = await run(project);
		expect(read(project, NOTIFIER)).toBe("// mine\n");
		expect(report.notes.join("\n")).toContain("authz.effectivePermissions(who)");
	});

	it("leaves an app without authz alone", async () => {
		const project = app(OLD, ["jobs", "notifications"]);
		await run(project);
		expect(read(project, NOTIFIER)).toBe(OLD);
		expect(existsSync(join(project.root, TEST))).toBe(false);
	});
});
