import { existsSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { glob } from "tinyglobby";
import type { Project, ProjectConfig } from "../project/config.ts";
import { ejectedPackages, pointAtEjected } from "../project/ejected.ts";

export class EjectError extends Error {}

export interface EjectOptions {
	/** also eject installed @tatara/* packages that depend on this one */
	withDependents?: boolean;
	/** formats a file in the app (default: none) */
	formatFile?: (file: string, project: Project) => Promise<void>;
}

export interface EjectReport {
	/** short names, e.g. ["http", "auth"] */
	ejected: string[];
	copied: string[];
	rewritten: string[];
	/** peers the ejected code imports that the app did not list; added to dependencies */
	added: string[];
}

interface PackageJson {
	name: string;
	version: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	peerDependenciesMeta?: Record<string, { optional?: boolean }>;
	imports?: Record<string, string>;
	/** commands and seeds the package contributes (read by `tatara sync`) */
	tatara?: object;
}

const short = (name: string) => name.replace(/^@tatara\//, "");
const full = (name: string) => `@tatara/${short(name)}`;
const NOT_LIBRARIES = new Set(["cli", "create-tatara"]);

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, "utf8")) as T;
}

/**
 * Copies a package's source into src/ejected/<name>, points the app's imports at it and records
 * it in tatara.json. From then on the app owns that code and `tatara upgrade` leaves it alone.
 */
export async function eject(
	project: Project,
	name: string,
	opts: EjectOptions = {},
): Promise<EjectReport> {
	const target = short(name);
	if (NOT_LIBRARIES.has(target)) throw new EjectError(`${full(target)} is a tool, not a library`);
	const appPkgPath = join(project.root, "package.json");
	const appPkg = await readJson<PackageJson>(appPkgPath);
	const installed = Object.keys({ ...appPkg.dependencies, ...appPkg.devDependencies })
		.filter((dep) => dep.startsWith("@tatara/") && !NOT_LIBRARIES.has(short(dep)))
		.map(short);
	const already = ejectedPackages(project.config);
	if (already.includes(target)) throw new EjectError(`${full(target)} is already ejected`);
	if (!installed.includes(target))
		throw new EjectError(`${full(target)} is not a dependency of this app`);

	const manifests = new Map<string, PackageJson>();
	for (const dep of installed) {
		const path = join(project.root, "node_modules", full(dep), "package.json");
		if (existsSync(path)) manifests.set(dep, await readJson<PackageJson>(path));
	}

	// every installed package that (transitively) peers on the target would keep its own import of
	// the original: two copies of shared classes, and instanceof checks quietly fail
	const chain = [target];
	for (let i = 0; i < chain.length; i++) {
		for (const [dep, manifest] of manifests) {
			if (chain.includes(dep)) continue;
			if (full(chain[i] as string) in (manifest.peerDependencies ?? {})) chain.push(dep);
		}
	}
	const dependents = chain.slice(1);
	if (dependents.length > 0 && !opts.withDependents) {
		throw new EjectError(
			`${dependents.map(full).join(", ")} depend on ${full(target)}. Eject them too with --with-dependents.`,
		);
	}

	const report: EjectReport = { ejected: chain, copied: [], rewritten: [], added: [] };
	const versions: Record<string, string> = {};
	for (const dep of chain) {
		const manifest = manifests.get(dep);
		const source = join(project.root, "node_modules", full(dep), "src");
		if (!manifest || !existsSync(source)) {
			throw new EjectError(
				`${full(dep)} ships no source to eject; update it to a version that does, then run this again`,
			);
		}
		versions[dep] = manifest.version;
		const files = await glob(["**/*.ts"], { cwd: source, ignore: ["**/*.test.ts"] });
		for (const file of files) {
			const to = `src/ejected/${dep}/${file}`;
			await mkdir(dirname(join(project.root, to)), { recursive: true });
			await cp(join(source, file), join(project.root, to));
			report.copied.push(to);
		}
		// `tatara sync` keeps wiring the package's commands and seeds from the copy
		if (manifest.tatara) {
			const to = `src/ejected/${dep}/tatara-package.json`;
			await writeFile(join(project.root, to), `${JSON.stringify(manifest.tatara, null, "\t")}\n`);
		}
	}

	const ejected = [...already, ...chain];
	for (const file of await glob(["src/**/*.ts", "tests/**/*.ts"], { cwd: project.root })) {
		const path = join(project.root, file);
		const text = await readFile(path, "utf8");
		const next = pointAtEjected(text, ejected);
		if (next !== text) {
			await writeFile(path, next);
			if (!report.copied.includes(file)) report.rewritten.push(file);
		}
	}

	// the copies import the packages' peers directly now, so the app must list them
	const deps = { ...appPkg.dependencies };
	const listed = new Set(Object.keys({ ...appPkg.dependencies, ...appPkg.devDependencies }));
	for (const dep of chain) {
		const manifest = manifests.get(dep) as PackageJson;
		for (const [peer, range] of Object.entries(manifest.peerDependencies ?? {})) {
			if (listed.has(peer) || manifest.peerDependenciesMeta?.[peer]?.optional) continue;
			if (peer.startsWith("@tatara/") && ejected.includes(short(peer))) continue;
			deps[peer] = range;
			listed.add(peer);
			report.added.push(peer);
		}
	}
	for (const dep of chain) delete deps[full(dep)];
	const devDeps = { ...appPkg.devDependencies };
	for (const dep of chain) delete devDeps[full(dep)];
	const nextPkg: PackageJson = {
		...appPkg,
		imports: { ...appPkg.imports, "#ejected/*": "./src/ejected/*.ts" },
		dependencies: Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b))),
		devDependencies: devDeps,
	};
	await writeFile(appPkgPath, `${JSON.stringify(nextPkg, null, "\t")}\n`);

	const configPath = join(project.root, "tatara.json");
	const config = await readJson<ProjectConfig>(configPath);
	await writeFile(
		configPath,
		`${JSON.stringify({ ...config, ejected: { ...config.ejected, ...versions } }, null, "\t")}\n`,
	);

	if (opts.formatFile) {
		for (const file of [...report.copied, ...report.rewritten, "package.json", "tatara.json"])
			await opts.formatFile(file, project);
	}
	return report;
}
