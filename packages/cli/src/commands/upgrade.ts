import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pc from "picocolors";
import { x } from "tinyexec";
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
	/** formats a file in the app (default: the app's own Biome, when installed) */
	formatFile?: (file: string, project: Project) => Promise<void>;
}

async function biomeFormat(file: string, project: Project): Promise<void> {
	const biome = join(project.root, "node_modules", ".bin", "biome");
	if (!existsSync(biome)) return;
	await x(biome, ["check", "--write", file], {
		throwOnError: false,
		nodeOptions: { cwd: project.root },
	});
}

/**
 * The recorded hashes stay what tatara generated: files the app changed keep their old (generated)
 * hash, and only files this upgrade wrote or removed are updated.
 */
async function nextRecord(
	project: Project,
	report: UpgradeReport,
): Promise<Record<string, string>> {
	const record = { ...(project.config.generated?.files ?? {}) };
	for (const path of report.removed) delete record[path];
	const current = await hashTrackedFiles(project.root);
	for (const path of report.written) {
		const hash = current[path];
		if (hash) record[path] = hash;
	}
	return record;
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

	const format = opts.formatFile ?? biomeFormat;
	for (const path of ctx.report.written) await format(path, project);
	await (opts.runSync ?? sync)(project);
	const path = join(project.root, "tatara.json");
	const config = JSON.parse(await readFile(path, "utf8")) as ProjectConfig;
	const next: ProjectConfig = {
		...config,
		version: target,
		generated: { cli: target, files: await nextRecord(project, ctx.report) },
	};
	if (JSON.stringify(next) !== JSON.stringify(config)) {
		await writeFile(path, `${JSON.stringify(next, null, "\t")}\n`);
		// JSON.stringify's layout fails the app's own lint, as in `tatara new`
		await format("tatara.json", project);
	}
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
