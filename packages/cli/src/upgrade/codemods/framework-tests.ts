import { isFrameworkTest } from "../../engine/generate.ts";
import type { Codemod } from "../codemods.ts";
import { sourceFiles } from "./groups.ts";

export const frameworkTests: Codemod = {
	version: "0.9.0",
	id: "framework-tests",
	description:
		"Remove tatara's own wiring tests from src/core; the packages and tatara's e2e cover them",
	async run(ctx) {
		for (const path of await sourceFiles(ctx)) {
			if (!isFrameworkTest(path)) continue;
			// the app's own tests in these folders are not tatara's to remove, or to report
			if (!(await ctx.baseline.isUnchanged(path, await ctx.read(path)))) continue;
			await ctx.removeIfUnchanged(path);
		}
	},
};
