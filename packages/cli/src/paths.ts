import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Package root: one level above both src/ (dev) and dist/ (published, bundled). */
export const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
export const TEMPLATES_DIR = resolve(PACKAGE_ROOT, "templates");

export function cliVersion(): string {
	const pkg = JSON.parse(readFileSync(resolve(PACKAGE_ROOT, "package.json"), "utf8")) as {
		version: string;
	};
	return pkg.version;
}

let versions: Record<string, string> | undefined;

/** Exact versions used in generated apps (templates/versions.json). */
export function templateVersions(): Record<string, string> {
	versions ??= JSON.parse(readFileSync(resolve(TEMPLATES_DIR, "versions.json"), "utf8")) as Record<
		string,
		string
	>;
	return versions;
}

export function versionOf(pkg: string): string {
	if (pkg === "@tatara/cli") return process.env.TATARA_CLI_SPEC ?? `^${cliVersion()}`;
	const version = templateVersions()[pkg];
	if (!version) throw new Error(`templates/versions.json has no version for "${pkg}"`);
	return version;
}
