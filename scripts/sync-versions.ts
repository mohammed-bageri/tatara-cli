/**
 * Pins each @tatara/* library in packages/cli/templates/versions.json at its package.json version.
 * Runs after `changeset version`, so a release scaffolds the library versions it ships with.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const FILE = join(ROOT, "packages/cli/templates/versions.json");

const versions = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, string>;
for (const dir of readdirSync(join(ROOT, "packages"), { withFileTypes: true })) {
	if (!dir.isDirectory()) continue;
	const pkg = JSON.parse(
		readFileSync(join(ROOT, "packages", dir.name, "package.json"), "utf8"),
	) as {
		name: string;
		version: string;
	};
	if (pkg.name in versions) versions[pkg.name] = pkg.version;
}
writeFileSync(FILE, `${JSON.stringify(versions, null, 2)}\n`);
