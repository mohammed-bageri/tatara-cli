import { spawn } from "node:child_process";
import pc from "picocolors";
import { pmCommands } from "../pm.ts";
import { loadProject, type Project } from "../project/config.ts";

export const VERIFY_STEPS = ["lint", "typecheck", "test", "build"] as const;

export function runInherit(cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv) {
	return new Promise<number>((resolve) => {
		const child = spawn(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
		child.on("exit", (code) => resolve(code ?? 1));
		child.on("error", () => resolve(1));
	});
}

/** Runs lint, typecheck, test and build in order; stops at the first failure. */
export async function verify(project: Project = loadProject()): Promise<boolean> {
	const pm = pmCommands(project.config.packageManager);
	const [cmd, ...prefix] = pm.run.split(" ");
	for (const step of VERIFY_STEPS) {
		console.log(pc.bold(pc.cyan(`\n▶ ${step}`)));
		const code = await runInherit(cmd ?? "npm", [...prefix, step], project.root);
		if (code !== 0) {
			console.log(pc.red(`\n✖ verify failed at "${step}"`));
			return false;
		}
	}
	console.log(pc.green("\n✔ verify passed (lint, typecheck, test, build)"));
	return true;
}
