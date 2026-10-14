import { spawn } from "node:child_process";
import type { Project } from "../project/config.ts";

export const NODE_FLAGS = ["--env-file-if-exists=.env", "--disable-warning=ExperimentalWarning"];

/** Runs `src/apps/cli/index.ts <args>` in the app, streaming output. Resolves the exit code. */
export function runAppCli(
	project: Project,
	args: string[],
	env?: NodeJS.ProcessEnv,
): Promise<number> {
	return new Promise((resolve) => {
		const child = spawn(process.execPath, [...NODE_FLAGS, "src/apps/cli/index.ts", ...args], {
			cwd: project.root,
			stdio: "inherit",
			env: { ...process.env, ...env },
		});
		child.on("exit", (code) => resolve(code ?? 1));
		child.on("error", () => resolve(1));
	});
}

export function runBin(project: Project, bin: string, args: string[]): Promise<number> {
	return new Promise((resolve) => {
		const child = spawn(`${project.root}/node_modules/.bin/${bin}`, args, {
			cwd: project.root,
			stdio: "inherit",
		});
		child.on("exit", (code) => resolve(code ?? 1));
		child.on("error", () => resolve(1));
	});
}
