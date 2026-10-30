import { versionOf } from "../../paths.ts";
import type { Codemod } from "../codemods.ts";
import type { UpgradeContext } from "../context.ts";

/** Copies replaced by a package export of the same name. */
const MOVED: { path: string; specifier: string; to: string; needsDb: boolean }[] = [
	{ path: "src/core/db/id.ts", specifier: "#core/db/id", to: "@tatara/db", needsDb: true },
	{ path: "src/core/db/seed.ts", specifier: "#core/db/seed", to: "@tatara/db", needsDb: true },
	{
		path: "tests/helpers/database-url.ts",
		specifier: "#tests/helpers/database-url",
		to: "@tatara/testing",
		needsDb: false,
	},
];

/** App files that stay, but become what this CLI generates (driver re-exports, thin helpers). */
const REGENERATED = [
	"src/core/db/admin.ts",
	"src/core/db/migrate.ts",
	"tests/helpers/api.ts",
	"tests/global-setup.ts",
];

async function read(ctx: UpgradeContext, path: string): Promise<string | undefined> {
	return ctx.read(path).catch(() => undefined);
}

export const dbTesting: Codemod = {
	version: "0.4.0",
	id: "db-testing",
	description: "Use @tatara/db (ids, seeds, driver helpers, migrations) and @tatara/testing",
	async run(ctx) {
		const hasDb = ctx.project.config.database !== "none";
		if (hasDb) await ctx.addDependency("@tatara/db", versionOf("@tatara/db"));
		await ctx.addDependency("@tatara/testing", versionOf("@tatara/testing"), { dev: true });

		// decide everything before changing anything
		const regenerate: string[] = [];
		for (const path of REGENERATED) {
			const text = await read(ctx, path);
			if (text === undefined) continue;
			if (await ctx.baseline.isUnchanged(path, text)) regenerate.push(path);
			else
				ctx.report.notes.push(
					`${path} is customised and was kept; compare it with a newly generated app.`,
				);
		}
		const moved = MOVED.filter((m) => hasDb || !m.needsDb);

		for (const path of regenerate) {
			const next = await ctx.renderCurrent(path);
			if (next !== undefined) await ctx.write(path, next);
		}
		for (const entry of moved) {
			const status = await ctx.removeIfUnchanged(entry.path);
			if (status === "kept") {
				ctx.report.notes.push(`${entry.path} is customised; its imports still point at it.`);
				continue;
			}
			await ctx.rewriteImports(entry.specifier, entry.to);
		}
	},
};
