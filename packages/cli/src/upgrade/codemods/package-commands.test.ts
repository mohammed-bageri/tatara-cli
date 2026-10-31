import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";
import { upgrade } from "../../commands/upgrade.ts";
import { loadProject } from "../../project/config.ts";
import { hashContent } from "../../project/hashes.ts";
import { packageCommands } from "./package-commands.ts";

it("removes unchanged command copies, keeps customised or imported ones", async () => {
	const root = mkdtempSync(join(tmpdir(), "tatara-package-commands-"));
	const generated = {
		"src/core/db/commands/migrate.ts": "// tatara's migrate\n",
		"src/core/db/commands/reset.ts": "// tatara's reset\n",
		"src/core/authz/db/seed.ts": "// tatara's seed\n",
		"src/core/email/commands/send-test.ts": "// tatara's\n",
	};
	const files: Record<string, string> = {
		...generated,
		"src/core/authz/db/seed.ts": "// tatara's seed, edited\n",
		"tests/reset.test.ts": 'import reset from "#core/db/commands/reset";\n',
		"package.json": "{}",
		"tatara.json": JSON.stringify({
			version: "0.8.0",
			name: "app",
			orm: "prisma",
			database: "postgres",
			auth: "none",
			authMethods: [],
			addons: ["authz", "email"],
			packageManager: "pnpm",
			generated: {
				cli: "0.8.0",
				files: Object.fromEntries(Object.entries(generated).map(([p, t]) => [p, hashContent(t)])),
			},
		}),
	};
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	const project = loadProject(root);
	const report = await upgrade(project, {
		cliVersion: "0.9.0",
		codemods: [packageCommands],
		baseline: {
			async isUnchanged(path, content) {
				return project.config.generated?.files[path] === hashContent(content);
			},
		},
		runSync: async () => {},
		runInstall: async () => {},
		formatFile: async () => {},
	});
	expect(report.removed.sort()).toEqual([
		"src/core/db/commands/migrate.ts",
		"src/core/email/commands/send-test.ts",
	]);
	expect(existsSync(join(root, "src/core/authz/db/seed.ts"))).toBe(true);
	expect(existsSync(join(root, "src/core/db/commands/reset.ts"))).toBe(true);
	expect(report.notes.join("\n")).toContain("tests/reset.test.ts import it");
});
