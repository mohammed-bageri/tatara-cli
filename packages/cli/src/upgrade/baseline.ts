import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { x } from "tinyexec";
import { cliVersion } from "../paths.ts";
import type { Project, ProjectConfig } from "../project/config.ts";
import { hashContent, hashTrackedFiles } from "../project/hashes.ts";

export type FileHashes = Record<string, string>;

export interface Baseline {
	/** True when `content` is what tatara generated for `path` (recorded, or in a released template). */
	isUnchanged(path: string, content: string): Promise<boolean>;
}

export interface BaselineDeps {
	releasedVersions: () => Promise<string[]>;
	releaseBaseline: (version: string, config: ProjectConfig) => Promise<FileHashes>;
	cliVersion: string;
}

const CACHE_DIR = join(
	process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"),
	"tatara",
	"baselines",
);

/** `major.minor.patch` comparison; prereleases are not considered. */
export function compareVersions(a: string, b: string): number {
	const pa = a.split(".").map(Number);
	const pb = b.split(".").map(Number);
	for (let i = 0; i < 3; i++) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (d !== 0) return d;
	}
	return 0;
}

/** Published @tatara/cli versions, without prereleases such as 0.0.0-stage. */
export async function releasedVersions(): Promise<string[]> {
	const res = await fetch("https://registry.npmjs.org/@tatara%2fcli");
	if (!res.ok) throw new Error(`npm registry answered ${res.status}`);
	const body = (await res.json()) as { versions?: Record<string, unknown> };
	return Object.keys(body.versions ?? {})
		.filter((v) => /^\d+\.\d+\.\d+$/.test(v))
		.sort(compareVersions);
}

function newFlags(config: ProjectConfig): string[] {
	return [
		"--orm",
		config.orm,
		"--db",
		config.database,
		"--auth",
		config.auth,
		...(config.authMethods.length ? ["--auth-methods", config.authMethods.join(",")] : []),
		...(config.addons.length ? ["--addons", config.addons.join(",")] : []),
		"--pm",
		config.packageManager,
	];
}

/** Templates contain the app name, so the release must render an app with the same name. */
export function renderTarget(base: string, config: ProjectConfig): string {
	return join(base, config.name);
}

/** What `@tatara/cli@<version> new` writes for these options (not installed, not formatted). */
export async function renderRelease(version: string, config: ProjectConfig): Promise<string> {
	const dir = renderTarget(await mkdtemp(join(tmpdir(), `tatara-${version}-`)), config);
	const res = await x(
		"npx",
		[
			"--yes",
			// the package is @tatara/cli but its binary is `tatara`
			"--package",
			`@tatara/cli@${version}`,
			"--",
			"tatara",
			"new",
			dir,
			...newFlags(config),
			"--yes",
			"--no-install",
			"--no-git",
		],
		{
			throwOnError: false,
			// outside any project, so npx downloads the release instead of a local @tatara/cli
			nodeOptions: { cwd: dirname(dir), env: { ...process.env, TATARA_CLI_SPEC: undefined } },
		},
	);
	if (res.exitCode !== 0) {
		throw new Error(
			`@tatara/cli@${version} could not generate these options: ${res.stderr.slice(-300)}`,
		);
	}
	return dir;
}

function digest(text: string): string {
	return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/**
 * Hashes of the tracked files `@tatara/cli@<version>` generates for `config`. With `formatWith`
 * (an app root), files are first formatted with that app's Biome and biome.json, so formatting
 * differences don't count as changes. Cached on disk.
 */
export interface BiomeFormatter {
	/** contents of the app's biome.json */
	config: string;
	/** installed @biomejs/biome version */
	version: string;
}

export function baselineCacheKey(
	version: string,
	config: ProjectConfig,
	biome?: BiomeFormatter,
): string {
	const inputs = JSON.stringify({ name: config.name, flags: newFlags(config) });
	const format = biome ? `-fmt-${digest(`${biome.version}\n${biome.config}`)}` : "";
	return `${version}-${digest(inputs)}${format}`;
}

async function appBiome(appRoot: string): Promise<BiomeFormatter | undefined> {
	const configFile = join(appRoot, "biome.json");
	const pkgFile = join(appRoot, "node_modules", "@biomejs", "biome", "package.json");
	if (!existsSync(configFile) || !existsSync(pkgFile)) return undefined;
	const { version } = JSON.parse(await readFile(pkgFile, "utf8")) as { version: string };
	return { config: await readFile(configFile, "utf8"), version };
}

/**
 * Hashes of the tracked files `@tatara/cli@<version>` generates for `config`. With `formatWith`
 * (an app root with Biome installed), files are first formatted with that app's Biome and
 * biome.json, so formatting differences don't count as changes. Cached on disk.
 */
export async function releaseBaseline(
	version: string,
	config: ProjectConfig,
	opts: { formatWith?: string } = {},
): Promise<FileHashes> {
	const biome = opts.formatWith ? await appBiome(opts.formatWith) : undefined;
	const cacheFile = join(CACHE_DIR, `${baselineCacheKey(version, config, biome)}.json`);
	if (existsSync(cacheFile)) return JSON.parse(await readFile(cacheFile, "utf8")) as FileHashes;

	const dir = await renderRelease(version, config);
	if (biome && opts.formatWith) {
		await cp(join(opts.formatWith, "biome.json"), join(dir, "biome.json"));
		const bin = join(opts.formatWith, "node_modules", ".bin", "biome");
		const res = await x(bin, ["check", "--write", "."], {
			throwOnError: false,
			nodeOptions: { cwd: dir },
		});
		// exit 1 can mean lint findings Biome won't fix; only a missing or crashing Biome is fatal
		if (res.exitCode !== 0 && res.exitCode !== 1) {
			throw new Error(
				`could not format the ${version} baseline with the app's Biome: ${res.stderr.slice(-300)}`,
			);
		}
	}
	const hashes = await hashTrackedFiles(dir);
	mkdirSync(CACHE_DIR, { recursive: true });
	await writeFile(cacheFile, JSON.stringify(hashes));
	return hashes;
}

export function createBaseline(project: Project, deps?: Partial<BaselineDeps>): Baseline {
	const resolved: BaselineDeps = {
		releasedVersions,
		releaseBaseline: (version, config) =>
			releaseBaseline(version, config, { formatWith: project.root }),
		cliVersion: cliVersion(),
		...deps,
	};
	const recorded = project.config.generated?.files ?? {};
	let releases: Promise<FileHashes[]> | undefined;

	async function loadReleases(): Promise<FileHashes[]> {
		const from = project.config.version;
		const versions = (await resolved.releasedVersions()).filter(
			(v) => compareVersions(v, from) >= 0 && compareVersions(v, resolved.cliVersion) <= 0,
		);
		const out: FileHashes[] = [];
		for (const v of versions) {
			// an older CLI may not support today's options (e.g. a newer auth method); skip it
			out.push(await resolved.releaseBaseline(v, project.config).catch(() => ({})));
		}
		return out;
	}

	return {
		async isUnchanged(path, content) {
			const hash = hashContent(content);
			if (recorded[path] === hash) return true;
			releases ??= loadReleases();
			return (await releases).some((files) => files[path] === hash);
		},
	};
}
