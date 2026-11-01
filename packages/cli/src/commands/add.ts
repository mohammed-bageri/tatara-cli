import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { devEnvFromExample, renderApp } from "../engine/generate.ts";
import { OptionsError, validateOptions } from "../engine/resolve.ts";
import type { Addon, AppOptions } from "../features/types.ts";
import { loadProject, type Project, type ProjectConfig } from "../project/config.ts";
import { hashTrackedFiles } from "../project/hashes.ts";
import { type Baseline, createBaseline } from "../upgrade/baseline.ts";
import { sync } from "./sync.ts";
import { biomeFormat, pmInstall } from "./upgrade.ts";

export interface AddReport {
	/** add-ons now in the app, the asked-for ones and those they bring */
	added: string[];
	/** files written: new ones, and generated ones the app never changed */
	written: string[];
	/** files the add-on changes that the app changed too: merge these by hand */
	merge: string[];
	notes: string[];
}

export interface AddOptions {
	baseline?: Baseline;
	runInstall?: (project: Project) => Promise<void>;
	runSync?: (project: Project) => Promise<unknown>;
	formatFile?: (file: string, project: Project) => Promise<void>;
}

const optionsOf = (config: ProjectConfig): AppOptions => ({
	name: config.name,
	orm: config.orm,
	database: config.database,
	auth: config.auth,
	authMethods: config.authMethods,
	addons: config.addons,
	packageManager: config.packageManager,
});

const envKeys = (text: string) =>
	new Set(
		text
			.split("\n")
			.map((line) => /^([A-Z0-9_]+)=/.exec(line)?.[1])
			.filter((key): key is string => Boolean(key)),
	);

/** `text` plus the entries of `from` (with the comment above each) whose keys it lacks. */
function withMissingEnv(text: string, from: string): string {
	const have = envKeys(text);
	const lines = from.split("\n");
	const extra: string[] = [];
	lines.forEach((line, i) => {
		const key = /^([A-Z0-9_]+)=/.exec(line)?.[1];
		if (!key || have.has(key)) return;
		const comment = lines[i - 1]?.startsWith("#") ? lines[i - 1] : undefined;
		if (comment) extra.push(comment);
		extra.push(line);
	});
	if (extra.length === 0) return text;
	return `${text.replace(/\n*$/, "\n")}${extra.join("\n")}\n`;
}

type PackageJson = Record<string, unknown> & {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	scripts?: Record<string, string>;
};

/** The app's package.json with what the add-ons need added; nothing the app set is changed. */
function withMissingPackages(current: string, rendered: string): string {
	const pkg = JSON.parse(current) as PackageJson;
	const next = JSON.parse(rendered) as PackageJson;
	for (const field of ["dependencies", "devDependencies", "scripts"] as const) {
		const add = Object.entries(next[field] ?? {}).filter(([name]) => !(name in (pkg[field] ?? {})));
		if (add.length > 0) pkg[field] = { ...pkg[field], ...Object.fromEntries(add) };
	}
	return `${JSON.stringify(pkg, null, "\t")}\n`;
}

/** The app's pnpm-workspace.yaml allowing the install scripts the add-ons need (pnpm stops otherwise). */
function withAllowedBuilds(current: string, rendered: string): string {
	const wanted = [...rendered.matchAll(/^ {2}"?([^":\s]+)"?: true$/gm)].map((m) => m[1] as string);
	let lines = current.replace(/^allowBuilds: \{\}$/m, "allowBuilds:").split("\n");
	for (const name of wanted) {
		const entry = `  "${name}": true`;
		const at = lines.findIndex((line) =>
			new RegExp(`^ {2}"?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"?:`).test(line),
		);
		if (at >= 0) lines[at] = entry;
		else {
			const header = lines.findIndex((line) => line === "allowBuilds:");
			if (header >= 0) lines.splice(header + 1, 0, entry);
			else lines = [...lines.filter(Boolean), "allowBuilds:", entry, ""];
		}
	}
	return lines.join("\n");
}

/**
 * Adds add-ons to an existing app: their new files, the generated files they change (when the app
 * left them as generated), their packages and env. Files the app changed are listed to merge.
 */
export async function addAddons(
	project: Project,
	requested: string[],
	opts: AddOptions = {},
): Promise<AddReport> {
	const before = optionsOf(project.config);
	const unknownOrPresent = requested.filter((a) => before.addons.includes(a as Addon));
	if (unknownOrPresent.length > 0)
		throw new OptionsError(`The app already has ${unknownOrPresent.join(", ")}`);
	const after = validateOptions({
		...before,
		addons: [...before.addons, ...(requested as Addon[])],
	});
	const added = after.addons.filter((a) => !before.addons.includes(a));
	const baseline = opts.baseline ?? createBaseline(project);
	const [old, now] = await Promise.all([renderApp(before), renderApp(after)]);
	const report: AddReport = { added, written: [], merge: [], notes: [] };
	const abs = (path: string) => join(project.root, path);
	const read = async (path: string) =>
		existsSync(abs(path)) ? readFile(abs(path), "utf8") : undefined;
	const write = async (path: string, text: string) => {
		await mkdir(dirname(abs(path)), { recursive: true });
		await writeFile(abs(path), text);
	};

	const merged: string[] = [];
	for (const [path, text] of now) {
		if (path === "tatara.json" || old.get(path) === text) continue;
		const current = await read(path);
		if ((path === "package.json" || path === "pnpm-workspace.yaml") && current !== undefined) {
			const next =
				path === "package.json"
					? withMissingPackages(current, text)
					: withAllowedBuilds(current, text);
			if (next !== current) {
				await write(path, next);
				merged.push(path);
			}
			continue;
		}
		if (current === undefined) {
			await write(path, text);
			report.written.push(path);
		} else if (old.has(path) && (await baseline.isUnchanged(path, current))) {
			await write(path, text);
			report.written.push(path);
		} else if (/^\.env\.(example|test)$/.test(path)) {
			await write(path, withMissingEnv(current, text));
			merged.push(path);
		} else if (current !== text) {
			report.merge.push(path);
		}
	}
	const dotEnv = await read(".env");
	if (dotEnv !== undefined) {
		const next = withMissingEnv(dotEnv, devEnvFromExample(after));
		if (next !== dotEnv) await write(".env", next);
	}

	const format = opts.formatFile ?? biomeFormat;
	for (const path of [...report.written, ...merged]) await format(path, project);

	const configPath = abs("tatara.json");
	const config = JSON.parse(await readFile(configPath, "utf8")) as ProjectConfig;
	const hashes = await hashTrackedFiles(project.root);
	const files = { ...(config.generated?.files ?? {}) };
	for (const path of report.written) if (hashes[path]) files[path] = hashes[path];
	const next: ProjectConfig = {
		...config,
		addons: after.addons,
		generated: { cli: config.generated?.cli ?? config.version, files },
	};
	await writeFile(configPath, `${JSON.stringify(next, null, "\t")}\n`);
	await format("tatara.json", project);

	await (opts.runInstall ?? pmInstall)(project);
	await (opts.runSync ?? sync)(loadProject(project.root));

	if (report.written.some((p) => /\/db\/[^/]+\.schema\.ts$|^prisma\/models\//.test(p)))
		report.notes.push("New tables: run `tatara db generate --name <add-on>` to migrate them.");
	if (report.merge.length > 0)
		report.notes.push(
			"Those files are yours now: compare each with a newly generated app with the same add-ons and copy in what's missing.",
		);
	return report;
}
