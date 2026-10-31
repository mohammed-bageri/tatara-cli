import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { x } from "tinyexec";
import { versionOf } from "../paths.ts";
import { pmCommands } from "../pm.ts";
import type { Project } from "../project/config.ts";
import { loadDocuments } from "./routes.ts";

export interface ContractsOptions {
	/** folder for `<app>.openapi.json` and `<app>.ts`, relative to the app */
	out?: string;
	/** compare instead of writing; returns the stale files */
	check?: boolean;
	/** turns an OpenAPI file into TypeScript (default: openapi-typescript through the package manager) */
	generateTypes?: (input: string, output: string, cwd: string) => Promise<void>;
}

async function openapiTypescript(project: Project, input: string, output: string): Promise<void> {
	// run on demand: it needs TypeScript 5 as a peer, and apps compile with TypeScript 7
	const [cmd = "npx", ...args] = pmCommands(project.config.packageManager).dlx;
	const spec = `openapi-typescript@${versionOf("openapi-typescript")}`;
	const res = await x(cmd, [...args, spec, input, "-o", output], {
		nodeOptions: { cwd: project.root },
		throwOnError: false,
	});
	if (res.exitCode !== 0)
		throw new Error(`openapi-typescript failed:\n${res.stderr || res.stdout}`);
}

/**
 * Writes each app's OpenAPI document and its TypeScript types, for typed clients:
 * `createClient<paths>({ baseUrl })` from openapi-fetch, with `paths` from `<app>.ts`.
 */
export async function writeContracts(project: Project, options: ContractsOptions = {}) {
	const out = options.out ?? "contracts";
	const generate =
		options.generateTypes ?? ((input, output) => openapiTypescript(project, input, output));
	const docs = await loadDocuments(project);
	const dir = options.check
		? await mkdtemp(join(tmpdir(), "tatara-contracts-"))
		: join(project.root, out);
	await mkdir(dir, { recursive: true });
	const written: string[] = [];
	try {
		for (const [app, doc] of Object.entries(docs)) {
			const json = join(dir, `${app}.openapi.json`);
			await writeFile(json, `${JSON.stringify(doc, null, 2)}\n`);
			await generate(json, join(dir, `${app}.ts`), project.root);
			written.push(`${out}/${app}.openapi.json`, `${out}/${app}.ts`);
		}
		if (!options.check) return { written, stale: [] as string[] };
		const stale: string[] = [];
		for (const file of written) {
			const name = file.slice(out.length + 1);
			const fresh = await readFile(join(dir, name), "utf8");
			const current = await readFile(join(project.root, file), "utf8").catch(() => undefined);
			if (current !== fresh) stale.push(file);
		}
		return { written: [], stale };
	} finally {
		if (options.check) await rm(dir, { recursive: true, force: true });
	}
}
