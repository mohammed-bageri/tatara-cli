import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Addon, AuthMethod, AuthProvider, Database, Orm, PackageManager } from "../features/types.ts";

export interface ProjectConfig {
	$schema?: string;
	/** tatara version the app was created with */
	version: string;
	name: string;
	orm: Orm | "none";
	database: Database | "none";
	auth: AuthProvider;
	authMethods: AuthMethod[];
	addons: Addon[];
	packageManager: PackageManager;
}

export class NotATataraProject extends Error {
	constructor(from: string) {
		super(`No tatara.json found in ${from} or its parents. Run this inside a tatara app.`);
	}
}

/** Finds the app root (the nearest folder with tatara.json) starting from `from`. */
export function findProjectRoot(from = process.cwd()): string {
	let dir = resolve(from);
	for (;;) {
		if (existsSync(join(dir, "tatara.json"))) return dir;
		const parent = dirname(dir);
		if (parent === dir) throw new NotATataraProject(from);
		dir = parent;
	}
}

export interface Project {
	root: string;
	config: ProjectConfig;
	has(feature: string): boolean;
}

export function loadProject(from = process.cwd()): Project {
	const root = findProjectRoot(from);
	const config = JSON.parse(readFileSync(join(root, "tatara.json"), "utf8")) as ProjectConfig;
	const features = new Set<string>([
		config.orm,
		config.database,
		config.auth,
		...config.authMethods.map((m) => `auth-${m}`),
		...config.addons,
		...(config.auth === "none" ? [] : ["auth"]),
	]);
	return { root, config, has: (f) => features.has(f) };
}
