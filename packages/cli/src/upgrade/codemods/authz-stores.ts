import type { Codemod } from "../codemods.ts";
import { applyGroup, blockersOf, type Group, sourceFiles } from "./groups.ts";

const group: Group = {
	name: "authz store",
	regenerate: ["src/core/authz/index.ts"],
	remove: ["src/core/authz/db/store.ts"],
	// the store is reached as authz.store now
	rewrites: [{ from: "#core/authz/db/store", to: "#core/authz/index", names: [] }],
};

export const authzStores: Codemod = {
	version: "0.9.0",
	id: "authz-stores",
	description: "Use the Prisma or Drizzle authz store from @tatara/authz",
	async run(ctx) {
		if (!ctx.project.config.addons.includes("authz")) return;
		const blockers = await blockersOf(ctx, group, await sourceFiles(ctx));
		if (blockers.length > 0) {
			ctx.report.notes.push(
				`The authz store was not moved onto @tatara/authz: ${blockers.join("; ")}. Pass prismaAuthzStore(db) or drizzleAuthzStore(db, tables) to createAuthz by hand.`,
			);
			ctx.report.blocked.push("authz-stores");
			return;
		}
		await applyGroup(ctx, group);
	},
};
