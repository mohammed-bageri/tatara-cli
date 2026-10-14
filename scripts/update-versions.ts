/**
 * Refreshes packages/cli/templates/versions.json to the latest stable releases.
 * Run `pnpm versions:update`, then `pnpm e2e` before committing.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FILE = resolve(import.meta.dirname, "../packages/cli/templates/versions.json");
/** keep these on the runtime's major line */
const MAJOR_PINS: Record<string, number> = { "@types/node": 24 };

function view(spec: string, field: string): unknown {
	return JSON.parse(execFileSync("npm", ["view", spec, field, "--json"], { encoding: "utf8" }));
}

const isStable = (v: string) => /^\d+\.\d+\.\d+$/.test(v);
const compare = (a: string, b: string) => {
	const [x, y] = [a, b].map((v) => v.split(".").map(Number));
	for (let i = 0; i < 3; i++)
		if ((x?.[i] ?? 0) !== (y?.[i] ?? 0)) return (x?.[i] ?? 0) - (y?.[i] ?? 0);
	return 0;
};

/** Highest stable version; `latest` is not trusted because some packages tag prereleases. */
function latestStable(pkg: string): string {
	const versions = (view(pkg, "versions") as string[]).filter(isStable);
	const pin = MAJOR_PINS[pkg];
	const candidates = pin ? versions.filter((v) => v.startsWith(`${pin}.`)) : versions;
	const best = candidates.sort(compare).at(-1);
	if (!best) throw new Error(`no stable version for ${pkg}`);
	return best;
}

const current = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, string>;
const next: Record<string, string> = {};
for (const pkg of Object.keys(current)) next[pkg] = latestStable(pkg);

// Prisma packages move together; the MySQL driver must match the adapter's own pin.
for (const pkg of ["@prisma/client", "@prisma/adapter-pg", "@prisma/adapter-mariadb"]) {
	if (pkg in next && next.prisma) next[pkg] = next.prisma;
}
if (next["@prisma/adapter-mariadb"]) {
	const deps = view(
		`@prisma/adapter-mariadb@${next["@prisma/adapter-mariadb"]}`,
		"dependencies",
	) as Record<string, string>;
	if (deps.mariadb) next.mariadb = deps.mariadb.replace(/^[\^~]/, "");
}

const changed = Object.keys(next).filter((k) => next[k] !== current[k]);
writeFileSync(FILE, `${JSON.stringify(next, null, 2)}\n`);
console.log(
	changed.length
		? changed.map((k) => `${k}: ${current[k]} → ${next[k]}`).join("\n")
		: "all up to date",
);
