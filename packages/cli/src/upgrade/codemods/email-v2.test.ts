import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { upgrade } from "../../commands/upgrade.ts";
import { loadProject, type Project } from "../../project/config.ts";
import { hashContent } from "../../project/hashes.ts";
import { emailV2 } from "./email-v2.ts";

const OLD: Record<string, string> = {
	"src/core/email/send.ts": "export const old = 1;\n",
	"src/core/config/env.ts": "export const env = {};\n",
	".env.example": "PORT=3000\n",
	".env.test": "PORT=3000\n",
};

function app(overrides: Record<string, string> = {}): Project {
	const root = mkdtempSync(join(tmpdir(), "tatara-email-v2-"));
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
			addons: ["email"],
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
		codemods: [emailV2],
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

describe("0.11.0 email-v2 codemod", () => {
	it("regenerates an unchanged mailer with Mailgun and templates", async () => {
		const project = app();
		await run(project);
		expect(read(project, "src/core/email/send.ts")).toContain("export async function sendTemplate");
		expect(read(project, "src/core/config/env.ts")).toContain("MAILGUN_API_KEY");
	});

	it("leaves a customised mailer alone and says what changed", async () => {
		const project = app({ "src/core/email/send.ts": "export const mine = 1;\n" });
		const report = await run(project);
		expect(read(project, "src/core/email/send.ts")).toBe("export const mine = 1;\n");
		expect(report.notes.join("\n")).toContain("sendTemplate");
	});
});
