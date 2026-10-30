import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pc from "picocolors";
import { cliVersion as installedCliVersion } from "../paths.ts";
import type { Project, ProjectConfig } from "../project/config.ts";
import { hashTrackedFiles } from "../project/hashes.ts";
import { type Baseline, compareVersions, createBaseline } from "../upgrade/baseline.ts";
import { CODEMODS, type Codemod } from "../upgrade/codemods.ts";
import { createContext, type UpgradeReport } from "../upgrade/context.ts";
import { sync } from "./sync.ts";

export interface UpgradeOptions {
	dryRun?: boolean;
	codemods?: readonly Codemod[];
	cliVersion?: string;
	baseline?: Baseline;
	runSync?: (project: Project) => Promise<unknown>;
}

/**
 * Runs the codemods between the app's tatara version and this CLI's, then syncs and records the
 * new version and file hashes. A failing codemod stops the upgrade before the version is recorded.
 */
export async function upgrade(project: Project, opts: UpgradeOptions = {}): Promise<UpgradeReport> {
	const target = opts.cliVersion ?? installedCliVersion();
	const from = project.config.version;
	const ctx = createContext(project, opts.baseline ?? createBaseline(project), {
		dryRun: opts.dryRun,
	});
	const due = [...(opts.codemods ?? CODEMODS)]
		.filter((m) => compareVersions(m.version, from) > 0 && compareVersions(m.version, target) <= 0)
		.sort((a, b) => compareVersions(a.version, b.version));

	for (const mod of due) {
		try {
			await mod.run(ctx);
		} catch (error) {
			throw new Error(`codemod ${mod.id} (${mod.version}) failed: ${(error as Error).message}`, {
				cause: error,
			});
		}
		ctx.report.ran.push(mod.id);
	}
	if (opts.dryRun) return ctx.report;

	await (opts.runSync ?? sync)(project);
	const path = join(project.root, "tatara.json");
	const config = JSON.parse(await readFile(path, "utf8")) as ProjectConfig;
	const next: ProjectConfig = {
		...config,
		version: target,
		generated: { cli: target, files: await hashTrackedFiles(project.root) },
	};
	const text = `${JSON.stringify(next, null, "\t")}\n`;
	if (text !== `${JSON.stringify(config, null, "\t")}\n`) await writeFile(path, text);
	return ctx.report;
}

export function printUpgrade(report: UpgradeReport, from: string, to: string): void {
	if (report.ran.length === 0 && report.removed.length === 0 && report.kept.length === 0) {
		console.log(pc.green(`nothing to upgrade (${from} → ${to})`));
		return;
	}
	console.log(pc.bold(`tatara upgrade ${from} → ${to}`));
	for (const id of report.ran) console.log(`  ran ${id}`);
	for (const path of report.removed)
		console.log(pc.dim(`  removed ${path} (now provided by a package)`));
	for (const { path } of report.kept) {
		console.log(
			pc.yellow(`  kept ${path}: changed in this app; move the change into options or eject`),
		);
	}
	for (const note of report.notes) console.log(`  ${note}`);
}
