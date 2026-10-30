import { glob } from "tinyglobby";
import { versionOf } from "../../paths.ts";
import type { Codemod } from "../codemods.ts";
import type { UpgradeContext } from "../context.ts";

const AUTH = "@tatara/auth";
const KEYCLOAK = "@tatara/keycloak";

/** An import from a changed file that outside code may still use. */
interface Export {
	specifier: string;
	/** names that are gone; undefined: the whole module is gone */
	names?: string[];
}

/** Files that change together: all of them move onto the package, or none do. */
interface Group {
	name: string;
	/** app files that stay, but become what this CLI generates */
	regenerate: string[];
	/** copies the package replaces */
	remove: string[];
	/** what outside files must not import, or the move would break them */
	exports: Export[];
}

const APP = "src/core/http/app.ts";
const HELPERS = "tests/helpers/auth.ts";

function groups(keycloak: boolean): Group[] {
	const all: Group[] = [
		{
			name: "OpenAPI merge and dev outbox",
			regenerate: [APP, "src/core/auth/delivery.ts"],
			remove: ["src/core/auth/openapi.ts"],
			exports: [
				{ specifier: "#core/auth/openapi" },
				{
					specifier: "#core/auth/delivery",
					names: ["outboxEnabled", "readOutbox", "OutboxMessage"],
				},
			],
		},
		{
			name: "SMS sender",
			regenerate: ["src/core/auth/sms.ts"],
			remove: [],
			exports: [{ specifier: "#core/auth/sms", names: ["SmsSender"] }],
		},
		{
			name: "principal middleware",
			regenerate: ["src/core/auth/principal.ts"],
			remove: [],
			exports: [],
		},
	];
	if (!keycloak) {
		all.push({ name: "test helpers", regenerate: [HELPERS], remove: [], exports: [] });
		return all;
	}
	all.push({
		name: "Keycloak",
		regenerate: [
			"src/core/auth/auth.ts",
			"src/core/auth/keycloak.ts",
			"src/core/auth/commands/keycloak-token.ts",
			"src/core/auth/tests/keycloak-tokens.test.ts",
			HELPERS,
		],
		remove: ["src/core/auth/keycloak-plugin.ts"],
		exports: [
			{ specifier: "#core/auth/keycloak-plugin" },
			{
				specifier: "#core/auth/keycloak",
				names: [
					"issuer",
					"setKeySource",
					"verifyAccessToken",
					"rolesOf",
					"organizationOf",
					"KeycloakClaims",
				],
			},
			{ specifier: "#tests/helpers/auth", names: ["KeycloakTokenOptions"] },
		],
	});
	return all;
}

async function read(ctx: UpgradeContext, path: string): Promise<string | undefined> {
	return ctx.read(path).catch(() => undefined);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when `text` imports `entry` (or one of its gone names). */
function usesExport(text: string, entry: Export): boolean {
	const from = new RegExp(
		`import\\s+(?:type\\s+)?([^;]*?)\\s+from\\s+["']${escapeRegExp(entry.specifier)}["']`,
		"g",
	);
	const gone = entry.names;
	for (const match of text.matchAll(from)) {
		if (!gone) return true;
		const clause = match[1] ?? "";
		const braces = clause.match(/\{([^}]*)\}/);
		// a namespace or default import could reach any name
		if (!braces) return true;
		const imported = (braces[1] ?? "").split(",").map((part) =>
			part
				.trim()
				.replace(/^type\s+/, "")
				.split(/\s+as\s+/)[0]
				?.trim(),
		);
		if (imported.some((name) => name && gone.includes(name))) return true;
	}
	return false;
}

/** Why the group can't move, or [] when it can. */
async function blockersOf(ctx: UpgradeContext, group: Group, sources: string[]): Promise<string[]> {
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
		if (group.exports.some((entry) => usesExport(text, entry)))
			blockers.push(`${path} imports what moves`);
	}
	return blockers;
}

export const authPackage: Codemod = {
	version: "0.5.0",
	id: "auth-package",
	description: "Use @tatara/auth (guards, principal, OpenAPI merge, outbox) and @tatara/keycloak",
	async run(ctx) {
		const { config } = ctx.project;
		if (config.auth === "none") return;
		const keycloak = config.authMethods.includes("keycloak");
		await ctx.addDependency(AUTH, versionOf(AUTH));
		if (keycloak) await ctx.addDependency(KEYCLOAK, versionOf(KEYCLOAK));

		const sources = await glob(["src/**/*.ts", "tests/**/*.ts"], {
			cwd: ctx.project.root,
			ignore: ["src/generated/**"],
		});

		// decide everything before changing anything
		const ready: Group[] = [];
		for (const group of groups(keycloak)) {
			const blockers = await blockersOf(ctx, group, sources);
			if (blockers.length === 0) ready.push(group);
			else
				ctx.report.notes.push(
					`${group.name} was not moved onto ${group.name === "Keycloak" ? KEYCLOAK : AUTH}: ${blockers.join("; ")}. Compare these files with a newly generated app and move them by hand.`,
				);
		}

		for (const group of ready) {
			for (const path of group.regenerate) {
				if ((await read(ctx, path)) === undefined) continue;
				const next = await ctx.renderCurrent(path);
				if (next !== undefined) await ctx.write(path, next);
			}
			for (const path of group.remove) await ctx.removeIfUnchanged(path);
		}

		// the guards keep their names in the package, so any importer can switch
		const middleware = await ctx.removeIfUnchanged("src/core/auth/middleware.ts");
		if (middleware === "kept")
			ctx.report.notes.push(
				"src/core/auth/middleware.ts is customised; its imports still point at it.",
			);
		else await ctx.rewriteImports("#core/auth/middleware", AUTH);
	},
};
