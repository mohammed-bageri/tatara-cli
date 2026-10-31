import { glob } from "tinyglobby";
import type { UpgradeContext } from "../context.ts";
import { importsOf } from "./imports.ts";

/** Where other files' imports of a replaced module go, and the names that exist there. */
export interface Rewrite {
	from: string;
	to: string;
	/** names that keep working at `to`; undefined: every name */
	names?: string[];
}

/** Files that change together: all of them move onto the package, or none do. */
export interface Group {
	name: string;
	/** app files that stay and become what this CLI generates (written when missing) */
	regenerate: string[];
	/** copies the package replaces */
	remove: string[];
	rewrites: Rewrite[];
}

async function read(ctx: UpgradeContext, path: string): Promise<string | undefined> {
	return ctx.read(path).catch(() => undefined);
}

export function sourceFiles(ctx: UpgradeContext): Promise<string[]> {
	return glob(["src/**/*.ts", "tests/**/*.ts"], {
		cwd: ctx.project.root,
		ignore: ["src/generated/**"],
	});
}

/** Why the group can't move ([] when it can). Changes nothing. */
export async function blockersOf(
	ctx: UpgradeContext,
	group: Group,
	sources: string[],
): Promise<string[]> {
	const blockers: string[] = [];
	for (const path of [...group.regenerate, ...group.remove]) {
		const text = await read(ctx, path);
		if (text === undefined) continue;
		if (!(await ctx.baseline.isUnchanged(path, text))) blockers.push(`${path} is customised`);
	}
	const own = new Set([...group.regenerate, ...group.remove]);
	for (const path of sources) {
		if (own.has(path)) continue;
		const text = await ctx.read(path);
		for (const rewrite of group.rewrites) {
			const names = importsOf(text, rewrite.from);
			if (!names) continue;
			const allowed = rewrite.names;
			const missing = names.filter(
				(n) => n === "*" || (allowed !== undefined && !allowed.includes(n)),
			);
			if (missing.length > 0)
				blockers.push(`${path} imports ${missing.join(", ")} from ${rewrite.from}`);
		}
	}
	return blockers;
}

export async function applyGroup(ctx: UpgradeContext, group: Group): Promise<void> {
	for (const path of group.regenerate) {
		const next = await ctx.renderCurrent(path);
		if (next !== undefined) await ctx.write(path, next);
	}
	for (const path of group.remove) await ctx.removeIfUnchanged(path);
	for (const rewrite of group.rewrites) await ctx.rewriteImports(rewrite.from, rewrite.to);
}
