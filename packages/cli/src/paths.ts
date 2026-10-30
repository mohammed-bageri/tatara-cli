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

/** `TATARA_PACKAGE_SPECS='{"@tatara/core":"file:…"}'` installs local builds (e2e, bench). */
function packageSpecOverride(pkg: string): string | undefined {
	const raw = process.env.TATARA_PACKAGE_SPECS;
	if (!raw) return undefined;
	return (JSON.parse(raw) as Record<string, string>)[pkg];
}

export function versionOf(pkg: string): string {
	const override = packageSpecOverride(pkg);
	if (override) return override;
	if (pkg === "@tatara/cli") return process.env.TATARA_CLI_SPEC ?? `^${cliVersion()}`;
	const version = templateVersions()[pkg];
	if (!version) throw new Error(`templates/versions.json has no version for "${pkg}"`);
	// tatara's packages take patch and minor fixes; third-party libraries stay pinned
	return pkg.startsWith("@tatara/") ? `^${version}` : version;
}
