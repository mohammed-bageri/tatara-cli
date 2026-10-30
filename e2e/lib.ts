/** Helpers shared by the e2e matrix (run.ts) and the bench (../bench/run.ts). */
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dirname, "..");
export const CLI = join(ROOT, "packages/cli");

export function run(
	cmd: string,
	cmdArgs: string[],
	options: { cwd: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; log?: string },
): Promise<{ code: number; out: string }> {
	return new Promise((resolvePromise) => {
		const child = spawn(cmd, cmdArgs, {
			cwd: options.cwd,
			env: { ...process.env, FORCE_COLOR: "0", ...options.env },
		});
		let out = "";
		child.stdout.on("data", (d: Buffer) => {
			out += d.toString();
		});
		child.stderr.on("data", (d: Buffer) => {
			out += d.toString();
		});
		const timer = setTimeout(() => child.kill("SIGKILL"), options.timeoutMs ?? 15 * 60_000);
		child.on("close", (code) => {
			clearTimeout(timer);
			if (options.log) writeFileSync(options.log, out, { flag: "a" });
			resolvePromise({ code: code ?? 1, out });
		});
		child.on("error", (error) => {
			clearTimeout(timer);
			resolvePromise({ code: 1, out: `${out}\n${String(error)}` });
		});
	});
}

/** Builds and packs @tatara/cli into <work>/pkg; returns the tarball path. */
export async function packCli(work: string): Promise<string> {
	const build = await run("pnpm", ["--filter", "@tatara/cli", "run", "build"], { cwd: ROOT });
	if (build.code !== 0) throw new Error(build.out);
	const pkgDir = join(work, "pkg");
	rmSync(pkgDir, { recursive: true, force: true });
	mkdirSync(pkgDir, { recursive: true });
	const pack = await run("pnpm", ["pack", "--pack-destination", pkgDir], { cwd: CLI });
	if (pack.code !== 0) throw new Error(pack.out);
	return join(pkgDir, readdirSync(pkgDir).find((f) => f.endsWith(".tgz")) ?? "");
}

/** `tatara new <dir> <flags> --yes --no-git` with the packed CLI as the app's @tatara/cli. */
export async function generateApp(packed: string, dir: string, flags: string[]): Promise<void> {
	const res = await run(
		"node",
		[join(CLI, "dist/bin.mjs"), "new", dir, ...flags, "--yes", "--no-git"],
		{
			cwd: resolve(dir, ".."),
			env: { TATARA_CLI_SPEC: `file:${packed}` },
		},
	);
	if (res.code !== 0) throw new Error(res.out.slice(-1500));
}
