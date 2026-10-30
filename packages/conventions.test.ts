import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const APPS = new Set(["cli", "create-tatara"]);
const OWNED_BY_APP = [
	"hono",
	"@hono/zod-openapi",
	"better-auth",
	"prisma",
	"@prisma/client",
	"drizzle-orm",
	"zod",
];

interface Manifest {
	name?: string;
	type?: string;
	exports?: Record<string, { types?: string; import?: string }>;
	files?: string[];
	sideEffects?: boolean;
	publishConfig?: { access?: string };
	repository?: { directory?: string };
	engines?: { node?: string };
	dependencies?: Record<string, string>;
}

/** Every violated rule, as "<package>: <field> <problem>". */
export function conventionViolations(dir: string, packageDir: string): string[] {
	const pkg = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as Manifest;
	const id = pkg.name ?? dir;
	const out: string[] = [];
	const check = (ok: boolean, message: string) => {
		if (!ok) out.push(`${id}: ${message}`);
	};
	check(pkg.name === `@tatara/${dir}`, `name must be @tatara/${dir}`);
	check(pkg.type === "module", 'type must be "module"');
	const main = pkg.exports?.["."];
	check(
		Boolean(main?.types?.startsWith("./dist/") && main?.import?.startsWith("./dist/")),
		'exports["."] needs types and import under ./dist/',
	);
	check(JSON.stringify(pkg.files) === JSON.stringify(["dist"]), 'files must be ["dist"]');
	check(pkg.sideEffects === false, "sideEffects must be false");
	check(pkg.publishConfig?.access === "public", 'publishConfig.access must be "public"');
	check(
		pkg.repository?.directory === `packages/${dir}`,
		`repository.directory must be packages/${dir}`,
	);
	check(pkg.engines?.node === ">=24", 'engines.node must be ">=24"');
	for (const lib of OWNED_BY_APP) {
		check(!pkg.dependencies?.[lib], `${lib} must be a peerDependency, not a dependency`);
	}
	return out;
}

const libraries = readdirSync(join(ROOT, "packages"), { withFileTypes: true })
	.filter(
		(e) =>
			e.isDirectory() &&
			!APPS.has(e.name) &&
			existsSync(join(ROOT, "packages", e.name, "package.json")),
	)
	.map((e) => e.name);

describe("library package conventions", () => {
	it.each(libraries.length ? libraries : ["(none yet)"])("%s follows the conventions", (dir) => {
		if (dir === "(none yet)") return;
		expect(conventionViolations(dir, join(ROOT, "packages", dir))).toEqual([]);
	});

	it("new-package scaffolds a package that passes the conventions", () => {
		const temp = mkdtempSync(join(tmpdir(), "tatara-packages-"));
		cpSync(
			join(ROOT, "packages", "cli", "templates", "versions.json"),
			join(temp, "versions.json"),
		);
		execFileSync("node", [join(ROOT, "scripts", "new-package.ts"), "sample", "--peer", "hono"], {
			env: {
				...process.env,
				TATARA_PACKAGES_DIR: temp,
				TATARA_VERSIONS_FILE: join(temp, "versions.json"),
			},
		});
		const dir = join(temp, "sample");
		expect(conventionViolations("sample", dir)).toEqual([]);
		const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
			peerDependencies?: Record<string, string>;
		};
		expect(pkg.peerDependencies?.hono).toBeTruthy();
		for (const file of [
			"tsconfig.json",
			"tsdown.config.ts",
			"src/index.ts",
			"src/index.test.ts",
			"README.md",
		]) {
			expect(existsSync(join(dir, file)), file).toBe(true);
		}
	});
});

describe("templates/versions.json", () => {
	it("pins every library package at its current version", () => {
		const versions = JSON.parse(
			readFileSync(join(ROOT, "packages", "cli", "templates", "versions.json"), "utf8"),
		) as Record<string, string>;
		for (const dir of libraries) {
			const pkg = JSON.parse(readFileSync(join(ROOT, "packages", dir, "package.json"), "utf8")) as {
				name: string;
				version: string;
			};
			expect(versions[pkg.name], `${pkg.name} in versions.json`).toBe(pkg.version);
		}
	});
});
