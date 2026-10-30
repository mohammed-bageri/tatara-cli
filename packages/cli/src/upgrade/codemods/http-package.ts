import { glob } from "tinyglobby";
import { versionOf } from "../../paths.ts";
import type { Codemod } from "../codemods.ts";
import type { UpgradeContext } from "../context.ts";

const HTTP = "@tatara/http";

/** Wiring files the app keeps; replaced by what this CLI generates when the app never changed them. */
const APP = "src/core/http/app.ts";
const ROUTES = "src/core/http/routes.ts";
const SERVERS = ["src/apps/api/server.ts", "src/apps/admin/server.ts"];

/** Files @tatara/http replaces: import specifier, and the wiring files that import them. */
const MOVED: { path: string; specifier: string; usedBy: string[] }[] = [
	{ path: "src/core/http/errors.ts", specifier: "#core/http/errors", usedBy: [] },
	{ path: "src/core/http/response.ts", specifier: "#core/http/response", usedBy: [] },
	{
		path: "src/core/http/middleware/validation.ts",
		specifier: "#core/http/middleware/validation",
		usedBy: [APP, ROUTES],
	},
	{
		path: "src/core/http/middleware/error-handler.ts",
		specifier: "#core/http/middleware/error-handler",
		usedBy: [APP],
	},
	{
		path: "src/core/http/middleware/request-context.ts",
		specifier: "#core/http/middleware/request-context",
		usedBy: [APP],
	},
	{ path: "src/core/http/server.ts", specifier: "#core/http/server", usedBy: SERVERS },
];

async function read(ctx: UpgradeContext, path: string): Promise<string | undefined> {
	return ctx.read(path).catch(() => undefined);
}

/** Files outside the group that import one of the moved files (they would break). */
async function outsideImporters(ctx: UpgradeContext): Promise<string[]> {
	const group = new Set([APP, ROUTES, ...SERVERS, ...MOVED.map((m) => m.path)]);
	const specifiers = MOVED.filter((m) => m.usedBy.length > 0).map((m) => m.specifier);
	const pattern = new RegExp(
		`["'](${specifiers.map((s) => s.replace(/[/.]/g, "\\$&")).join("|")})["']`,
	);
	const out: string[] = [];
	for (const path of await glob(["src/**/*.ts", "tests/**/*.ts"], {
		cwd: ctx.project.root,
		ignore: ["src/generated/**"],
	})) {
		if (group.has(path)) continue;
		if (pattern.test(await ctx.read(path))) out.push(path);
	}
	return out;
}

export const httpPackage: Codemod = {
	version: "0.3.0",
	id: "http-package",
	description: "Use @tatara/http for app setup, errors, the envelope, OpenAPI docs and the server",
	async run(ctx) {
		await ctx.addDependency(HTTP, versionOf(HTTP));

		// all or nothing: the error classes, error handler and wiring must move together, or an
		// app's own errors stop matching the package's handler. Decide before changing anything.
		const blockers: string[] = [];
		const replace: string[] = [];
		for (const path of [APP, ROUTES, ...SERVERS]) {
			const text = await read(ctx, path);
			if (text === undefined) continue;
			if (await ctx.baseline.isUnchanged(path, text)) replace.push(path);
			else blockers.push(`${path} is customised`);
		}
		const present: typeof MOVED = [];
		for (const entry of MOVED) {
			const text = await read(ctx, entry.path);
			if (text === undefined) continue;
			present.push(entry);
			if (!(await ctx.baseline.isUnchanged(entry.path, text)))
				blockers.push(`${entry.path} is customised`);
		}
		for (const path of await outsideImporters(ctx))
			blockers.push(`${path} imports one of the moved files`);

		if (blockers.length > 0) {
			ctx.report.notes.push(
				`Nothing in src/core/http was changed: ${blockers.join("; ")}. Move these onto @tatara/http (createApp, mountRoutes, serveOpenApi, handleErrors, startServer and its error classes) by hand, then delete the old files.`,
			);
			return;
		}

		for (const path of replace) {
			const next = await ctx.renderCurrent(path);
			if (next !== undefined) await ctx.write(path, next);
		}
		for (const entry of present) await ctx.removeIfUnchanged(entry.path);
		// errors, the envelope and the validation hook keep their names in the package
		for (const specifier of [
			"#core/http/errors",
			"#core/http/response",
			"#core/http/middleware/validation",
		]) {
			await ctx.rewriteImports(specifier, HTTP);
		}
	},
};
