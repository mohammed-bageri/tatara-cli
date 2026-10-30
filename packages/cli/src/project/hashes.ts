import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { glob } from "tinyglobby";

/** Framework files a package can replace; `tatara upgrade` tracks these. */
export const TRACKED_PATTERNS = [
	"src/core/**",
	"src/apps/**",
	"tests/helpers/**",
	"tests/setup.ts",
	"tests/global-setup.ts",
] as const;

export function hashContent(text: string): string {
	return `sha256-${createHash("sha256").update(text).digest("base64")}`;
}

/** Relative POSIX path → content hash, for every tracked file under `root`. */
export async function hashTrackedFiles(root: string): Promise<Record<string, string>> {
	const paths = await glob([...TRACKED_PATTERNS], { cwd: root, dot: true, onlyFiles: true });
	const out: Record<string, string> = {};
	for (const path of paths.sort()) {
		out[path.replaceAll("\\", "/")] = hashContent(await readFile(join(root, path), "utf8"));
	}
	return out;
}
