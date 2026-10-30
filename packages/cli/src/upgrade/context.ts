import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { glob } from "tinyglobby";
import type { Project } from "../project/config.ts";
import type { Baseline } from "./baseline.ts";

export interface UpgradeReport {
	ran: string[];
	/** files a codemod wrote (relative paths) */
	written: string[];
	removed: string[];
	kept: { path: string; diff: string }[];
	notes: string[];
}

export interface UpgradeContext {
	project: Project;
	baseline: Baseline;
	report: UpgradeReport;
	read(path: string): Promise<string>;
	write(path: string, text: string): Promise<void>;
	/** Deletes a framework file the app never changed; a changed file is kept and reported. */
	removeIfUnchanged(path: string): Promise<"removed" | "kept" | "missing">;
	/** Rewrites `from` and `from/...` import specifiers in src/ and tests/; returns files changed. */
	rewriteImports(from: string, to: string): Promise<number>;
	addDependency(name: string, range: string, opts?: { dev?: boolean }): Promise<void>;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function createContext(
	project: Project,
	baseline: Baseline,
	opts: { dryRun?: boolean } = {},
): UpgradeContext {
	const report: UpgradeReport = { ran: [], written: [], removed: [], kept: [], notes: [] };
	const abs = (path: string) => join(project.root, path);
	const write = async (path: string, text: string) => {
		if (!report.written.includes(path)) report.written.push(path);
		if (opts.dryRun) return;
		await mkdir(dirname(abs(path)), { recursive: true });
		await writeFile(abs(path), text);
	};

	return {
		project,
		baseline,
		report,
		read: (path) => readFile(abs(path), "utf8"),
		write,
		async removeIfUnchanged(path) {
			if (!existsSync(abs(path))) return "missing";
			const content = await readFile(abs(path), "utf8");
			if (await baseline.isUnchanged(path, content)) {
				if (!opts.dryRun) await rm(abs(path));
				report.removed.push(path);
				return "removed";
			}
			// only hashes are recorded, so the diff shows the app's version of the file
			const diff = content
				.split("\n")
				.map((line) => `+${line}`)
				.join("\n");
			report.kept.push({ path, diff });
			return "kept";
		},
		async rewriteImports(from, to) {
			const pattern = new RegExp(`(["'])${escapeRegExp(from)}(?=(?:/[^"']*)?\\1)`, "g");
			let changed = 0;
			for (const path of await glob(["src/**/*.ts", "tests/**/*.ts"], {
				cwd: project.root,
				ignore: ["src/generated/**"],
			})) {
				const text = await readFile(abs(path), "utf8");
				const next = text.replace(pattern, `$1${to}`);
				if (next !== text) {
					await write(path, next);
					changed++;
				}
			}
			return changed;
		},
		async addDependency(name, range, { dev = false } = {}) {
			const pkg = JSON.parse(await readFile(abs("package.json"), "utf8")) as Record<
				string,
				Record<string, string> | undefined
			>;
			const key = dev ? "devDependencies" : "dependencies";
			pkg[key] = { ...pkg[key], [name]: range };
			await write("package.json", `${JSON.stringify(pkg, null, "\t")}\n`);
		},
	};
}
