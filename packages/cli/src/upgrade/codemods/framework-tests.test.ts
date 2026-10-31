import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";
import { upgrade } from "../../commands/upgrade.ts";
import { loadProject } from "../../project/config.ts";
import { hashContent } from "../../project/hashes.ts";
import { frameworkTests } from "./framework-tests.ts";

it("removes unchanged framework tests and leaves the app's own tests alone", async () => {
	const root = mkdtempSync(join(tmpdir(), "tatara-framework-tests-"));
	const generated = {
		"src/core/authz/tests/authz.test.ts": "// tatara's\n",
		"src/core/config/tests/env.test.ts": "// tatara's\n",
	};
	const files: Record<string, string> = {
		...generated,
		"src/core/config/tests/env.test.ts": "// tatara's, then edited\n",
		"src/core/auth/tests/game-auth.test.ts": "// the app's own\n",
		"src/modules/example/tests/greeting.test.ts": "// example\n",
		"package.json": "{}",
		"tatara.json": JSON.stringify({
			version: "0.8.0",
			name: "app",
			orm: "none",
			database: "none",
			auth: "none",
			authMethods: [],
			addons: [],
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
		codemods: [frameworkTests],
		baseline: {
			async isUnchanged(path, content) {
				return project.config.generated?.files[path] === hashContent(content);
			},
		},
		runSync: async () => {},
		formatFile: async () => {},
	});
	expect(report.removed).toEqual(["src/core/authz/tests/authz.test.ts"]);
	expect(report.kept).toEqual([]);
	for (const kept of [
		"src/core/config/tests/env.test.ts",
		"src/core/auth/tests/game-auth.test.ts",
		"src/modules/example/tests/greeting.test.ts",
	])
		expect(existsSync(join(root, kept))).toBe(true);
});
