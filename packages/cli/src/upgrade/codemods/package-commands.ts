import { ejectedPackages } from "../../project/ejected.ts";
import type { Codemod } from "../codemods.ts";
import { sourceFiles } from "./groups.ts";
import { importsOf } from "./imports.ts";

/** Copies whose commands and seeds the packages contribute now (wired by `tatara sync`). */
const COPIES = [
	"src/core/db/commands/migrate.ts",
	"src/core/db/commands/reset.ts",
	"src/core/db/commands/seed.ts",
	"src/core/authz/commands/grant-role.ts",
	"src/core/authz/commands/sync-permissions.ts",
	"src/core/authz/db/seed.ts",
	"src/core/email/commands/send-test.ts",
	"src/core/storage/commands/check.ts",
	"src/core/jobs/commands/enqueue.ts",
];

const specifierOf = (path: string) => `#${path.replace(/^src\//, "").replace(/\.ts$/, "")}`;

export const packageCommands: Codemod = {
	version: "0.9.0",
	id: "package-commands",
	description: "Take db, authz, email, storage and jobs commands and seeds from their packages",
	async run(ctx) {
		const sources = await sourceFiles(ctx);
		const texts = new Map<string, string>();
		for (const path of sources) texts.set(path, await ctx.read(path));
		// an ejected copy from before 0.9 declares no commands, so the app's copies are still needed
		const ejected = ejectedPackages(ctx.project.config);
		for (const path of COPIES) {
			if (!texts.has(path)) continue;
			if (ejected.includes(path.split("/")[2] ?? "")) continue;
			// a customised copy stays, and sync lets it win over the package's command of the same name
			const importers = [...texts].filter(
				([other, text]) => other !== path && importsOf(text, specifierOf(path)),
			);
			if (importers.length > 0) {
				ctx.report.notes.push(
					`${path} was kept: ${importers.map(([p]) => p).join(", ")} import it.`,
				);
				continue;
			}
			await ctx.removeIfUnchanged(path);
		}
	},
};
