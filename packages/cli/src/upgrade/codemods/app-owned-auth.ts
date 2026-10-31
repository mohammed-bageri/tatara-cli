import { glob } from "tinyglobby";
import type { Codemod } from "../codemods.ts";
import type { UpgradeContext } from "../context.ts";
import { MERGED_IN_0_10, MOVED_IN_0_10 } from "../moves.ts";

/** Import specifiers that moved, old → new; every name keeps working at the new place. */
const SPECIFIERS: Record<string, string> = {
	"#core/http/app": "#apps/http",
	"#core/auth/auth": "#modules/users/services/auth",
	"#core/auth/principal": "#modules/users/services/auth",
	"#core/auth/adapter": "#modules/users/services/adapter",
	"#core/auth/delivery": "#modules/users/services/delivery",
	"#core/auth/sms": "#modules/users/services/sms",
	"#core/auth/keycloak": "#modules/users/services/keycloak",
	"#core/auth/db/auth.schema": "#modules/users/db/auth.schema",
	"#core/auth/db/organization.schema": "#modules/users/db/organization.schema",
};

/** Files whose content this release changes in place (new imports, orgRole, single tenant). */
const REGENERATED = [
	"src/core/http/context.ts",
	"tests/helpers/auth.ts",
	"src/core/authz/index.ts",
];

async function read(ctx: UpgradeContext, path: string): Promise<string | undefined> {
	return ctx.read(path).catch(() => undefined);
}

/** Inserts the single-tenant option into an app's own createAuthz call, if it lacks one. */
function withSingleTenant(text: string): string {
	if (text.includes("singleTenant")) return text;
	return text.replace(/(createAuthz(?:<[^>]*>)?\(\{\n)/, '$1\tsingleTenant: "default",\n');
}

export const appOwnedAuth: Codemod = {
	version: "0.10.0",
	id: "app-owned-auth",
	description:
		"Move auth into src/modules/users and HTTP wiring into src/apps; explicit org context",
	async run(ctx) {
		const { config } = ctx.project;
		const orgs = config.authMethods.includes("orgs");

		// a non-org app's authz must say it's single-tenant now, whatever else happens: the package
		// no longer falls back to a default org
		if (config.addons.includes("authz") && !orgs) {
			const index = await read(ctx, "src/core/authz/index.ts");
			if (index && !(await ctx.baseline.isUnchanged("src/core/authz/index.ts", index))) {
				const next = withSingleTenant(index);
				if (next !== index) await ctx.write("src/core/authz/index.ts", next);
			}
		}

		// all or nothing: the moved files import each other at their new paths
		const blockers: string[] = [];
		const moves: [string, string][] = [];
		for (const [from, to] of Object.entries(MOVED_IN_0_10)) {
			const text = await read(ctx, from);
			if (text === undefined) continue;
			if (await ctx.baseline.isUnchanged(from, text)) moves.push([from, to]);
			else blockers.push(`${from} is customised`);
		}
		const merged: string[] = [];
		for (const from of Object.keys(MERGED_IN_0_10)) {
			const text = await read(ctx, from);
			if (text === undefined) continue;
			if (await ctx.baseline.isUnchanged(from, text)) merged.push(from);
			else blockers.push(`${from} is customised`);
		}
		if (blockers.length > 0) {
			ctx.report.notes.push(
				`Auth was not moved into src/modules/users: ${blockers.join("; ")}. Compare with a newly generated app (auth in src/modules/users/services/auth.ts built with createAuthInstance, HTTP wiring in src/apps/http.ts) and move it by hand.`,
			);
			ctx.report.blocked.push("app-owned-auth");
			return;
		}

		for (const [from, to] of moves) {
			const next = await ctx.renderCurrent(to);
			if (next !== undefined) await ctx.write(to, next);
			await ctx.removeIfUnchanged(from);
		}
		for (const from of merged) await ctx.removeIfUnchanged(from);
		for (const path of REGENERATED) {
			const text = await read(ctx, path);
			if (text !== undefined && (await ctx.baseline.isUnchanged(path, text)))
				await ctx.regenerate(path);
		}
		for (const [from, to] of Object.entries(SPECIFIERS)) await ctx.rewriteImports(from, to);

		// the app's own files in src/core/auth now sit in core but belong to the users module
		const leftovers = await glob(["src/core/auth/**/*.ts"], { cwd: ctx.project.root });
		if (leftovers.length > 0)
			ctx.report.notes.push(
				`Move these into src/modules/users (core must not hold auth flows): ${leftovers.join(", ")}`,
			);
		if (orgs)
			ctx.report.notes.push(
				"Requests that act in an organization now name it (x-org-id header, or the session's active organization); authz no longer falls back to a default org.",
			);
	},
};
