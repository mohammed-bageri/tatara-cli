import { glob } from "tinyglobby";
import { versionOf } from "../../paths.ts";
import type { Codemod } from "../codemods.ts";
import type { UpgradeContext } from "../context.ts";
import { importsOf } from "./imports.ts";

const AUTHZ = "@tatara/authz";
const INDEX = "#core/authz/index";
const DIR = "src/core/authz";

/** Copies the package replaces. */
const REMOVED = [
	"cache.ts",
	"catalog.ts",
	"constants.ts",
	"middleware.ts",
	"permissions.ts",
	"resolver.ts",
	"types.ts",
	"validators.ts",
	"services/audit.ts",
	"services/grants.ts",
	"services/members.ts",
	"services/roles.ts",
	"services/sync.ts",
].map((f) => `${DIR}/${f}`);

/** App files that stay (or are new), and become what this CLI generates. system-roles.ts is the app's config and stays as it is. */
const REGENERATED = [
	`${DIR}/index.ts`,
	`${DIR}/db/seed.ts`,
	`${DIR}/commands/grant-role.ts`,
	`${DIR}/commands/sync-permissions.ts`,
	`${DIR}/routes/authorization.routes.ts`,
	`${DIR}/tests/authz.test.ts`,
	"src/core/auth/tests/keycloak-authz.test.ts",
	"tests/helpers/authz.ts",
];

/** Where other files' imports go, and the names that exist there. undefined: every name. */
const MOVES: { from: string; to: string; names?: string[] }[] = [
	{ from: "#core/authz/constants", to: AUTHZ },
	{ from: "#core/authz/types", to: AUTHZ },
	{ from: "#core/authz/catalog", to: AUTHZ },
	{ from: "#core/authz/validators", to: AUTHZ },
	{ from: "#core/authz/middleware", to: INDEX, names: ["requirePermission"] },
	{ from: "#core/authz/resolver", to: INDEX, names: ["checkPermission", "resolveScope"] },
	{ from: "#core/authz/services/members", to: INDEX, names: ["removeMemberAccess"] },
	{ from: "#core/authz/cache", to: INDEX, names: [] },
	{ from: "#core/authz/permissions", to: INDEX, names: [] },
	...["audit", "grants", "roles", "sync"].map((s) => ({
		from: `#core/authz/services/${s}`,
		to: INDEX,
		names: [],
	})),
];

/** Names the 0.5 constants file had that the package dropped. */
const DROPPED_CONSTANTS = ["CACHE_TTL_MS"];

async function read(ctx: UpgradeContext, path: string): Promise<string | undefined> {
	return ctx.read(path).catch(() => undefined);
}

export const authzPackage: Codemod = {
	version: "0.6.0",
	id: "authz-package",
	description: "Use @tatara/authz (catalog, resolver, guards, services, routes)",
	async run(ctx) {
		if (!ctx.project.config.addons.includes("authz")) return;
		await ctx.addDependency(AUTHZ, versionOf(AUTHZ));

		// all or nothing: the services share one permission cache, so a half move could serve
		// stale permissions after a role change. Decide before changing anything.
		const blockers: string[] = [];
		const regenerate: string[] = [];
		for (const path of REGENERATED) {
			const text = await read(ctx, path);
			if (text === undefined) {
				if (path === `${DIR}/index.ts`) regenerate.push(path);
				continue;
			}
			if (await ctx.baseline.isUnchanged(path, text)) regenerate.push(path);
			else blockers.push(`${path} is customised`);
		}
		const removed: string[] = [];
		for (const path of REMOVED) {
			const text = await read(ctx, path);
			if (text === undefined) continue;
			removed.push(path);
			if (!(await ctx.baseline.isUnchanged(path, text))) blockers.push(`${path} is customised`);
		}
		const own = new Set([...REGENERATED, ...REMOVED]);
		const sources = await glob(["src/**/*.ts", "tests/**/*.ts"], {
			cwd: ctx.project.root,
			ignore: ["src/generated/**"],
		});
		for (const path of sources) {
			if (own.has(path)) continue;
			const text = await ctx.read(path);
			for (const move of MOVES) {
				const names = importsOf(text, move.from);
				if (!names) continue;
				const allowed = move.names;
				const missing = names.filter(
					(n) =>
						n === "*" ||
						(allowed
							? !allowed.includes(n)
							: move.from.endsWith("/constants") && DROPPED_CONSTANTS.includes(n)),
				);
				if (missing.length > 0)
					blockers.push(`${path} imports ${missing.join(", ")} from ${move.from}`);
			}
		}

		if (blockers.length > 0) {
			ctx.report.notes.push(
				`Nothing in ${DIR} was changed: ${blockers.join("; ")}. Compare with a newly generated app and move onto @tatara/authz (createAuthz in ${DIR}/index.ts) by hand.`,
			);
			ctx.report.blocked.push("authz-package");
			return;
		}

		for (const path of regenerate) {
			await ctx.regenerate(path);
		}
		for (const path of removed) await ctx.removeIfUnchanged(path);
		for (const move of MOVES) await ctx.rewriteImports(move.from, move.to);
	},
};
