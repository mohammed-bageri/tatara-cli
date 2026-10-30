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

export const httpPackage: Codemod = {
	version: "0.3.0",
	id: "http-package",
	description: "Use @tatara/http for app setup, errors, the envelope, OpenAPI docs and the server",
	async run(ctx) {
		await ctx.addDependency(HTTP, versionOf(HTTP));

		// decide everything before changing anything: rewritten imports would make files look customised
		const keptWiring = new Set<string>();
		const replace: string[] = [];
		for (const path of [APP, ROUTES, ...SERVERS]) {
			const text = await read(ctx, path);
			if (text === undefined) continue;
			if (await ctx.baseline.isUnchanged(path, text)) replace.push(path);
			else {
				keptWiring.add(path);
				ctx.report.notes.push(
					`${path} is customised and was kept; move it onto @tatara/http (createApp, mountRoutes, serveOpenApi, handleErrors, startServer) by hand.`,
				);
			}
		}
		const removable: typeof MOVED = [];
		for (const entry of MOVED) {
			const text = await read(ctx, entry.path);
			if (text === undefined || entry.usedBy.some((p) => keptWiring.has(p))) continue;
			if (await ctx.baseline.isUnchanged(entry.path, text)) removable.push(entry);
		}

		for (const path of replace) {
			const next = await ctx.renderCurrent(path);
			if (next !== undefined) await ctx.write(path, next);
		}
		for (const entry of removable) await ctx.removeIfUnchanged(entry.path);
		for (const entry of MOVED) {
			// errors and the envelope have the same names in the package; the rest only had wiring importers
			if (removable.includes(entry) && entry.usedBy.length === 0)
				await ctx.rewriteImports(entry.specifier, HTTP);
		}
		const validation = MOVED[2];
		if (validation && removable.includes(validation))
			await ctx.rewriteImports(validation.specifier, HTTP);
	},
};
