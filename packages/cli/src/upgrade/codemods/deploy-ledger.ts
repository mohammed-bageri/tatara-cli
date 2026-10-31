import type { Codemod } from "../codemods.ts";

const REGENERATED = ["src/apps/cli/index.ts", "src/core/db/admin.ts", "src/apps/api/server.ts"];
const ADDED = ["src/core/commands/db/command-runs.schema.ts", "prisma/models/command-runs.prisma"];

/** `deploy`: migrations and deploy/once commands, with a ledger of what ran once. */
export const deployLedger: Codemod = {
	version: "0.11.0",
	id: "deploy-ledger",
	description: "A deploy command (migrations, then deploy and once commands) with a command ledger",
	async run(ctx) {
		const { config } = ctx.project;
		const customised: string[] = [];
		for (const path of REGENERATED) {
			const text = await ctx.read(path).catch(() => undefined);
			if (text === undefined) continue;
			if (await ctx.baseline.isUnchanged(path, text)) await ctx.regenerate(path);
			else customised.push(path);
		}
		let added = false;
		for (const path of ADDED) {
			if ((await ctx.read(path).catch(() => undefined)) !== undefined) continue;
			const text = await ctx.renderCurrent(path);
			if (text === undefined) continue;
			await ctx.write(path, text);
			added = true;
		}
		if (customised.length > 0)
			ctx.report.notes.push(
				`Compare ${customised.join(", ")} with a newly generated app: runCommand takes { ledger: commandLedger(env.DATABASE_URL) } (commandLedger from #core/db/admin), and the api server takes an options slot.`,
			);
		if (added)
			ctx.report.notes.push(
				"MySQL keeps the command ledger in the app's own tatara_command_runs table: run `tatara db generate --name command_runs`.",
			);
		if (config.database !== "none")
			ctx.report.notes.push(
				"Deploys now run `node dist/apps/cli/index.mjs deploy` (migrations, then commands with a phase, e.g. authz:sync-permissions) instead of separate db:migrate and sync steps.",
			);
	},
};
