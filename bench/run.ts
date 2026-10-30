/**
 * Performance budgets: a generated app against plain Hono (bench/baseline-app).
 * Usage: pnpm bench [--json]. Exits 1 when a median is over its budget in bench/budgets.json.
 */
import { type ChildProcess, spawn } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { generateApp, packCli, packLibraries, ROOT, run } from "../e2e/lib.ts";
import { median } from "./stats.ts";

const WORK = join(ROOT, ".e2e", "bench");
const RUNS = 5;
const REQUESTS = 2000;
const PROD_ENV = {
	NODE_ENV: "production",
	LOG_LEVEL: "silent",
	APP_URL: "http://localhost",
	CORS_ORIGINS: "http://localhost",
};

type Budgets = Record<"requestOverheadMs" | "coldBootMs" | "corePackagesKb" | "sync100Ms", number>;

let nextPort = 39_100;

function start(
	cwd: string,
	file: string,
	env: Record<string, string>,
): { child: ChildProcess; url: string } {
	const port = nextPort++;
	const child = spawn("node", [file], {
		cwd,
		env: { ...process.env, ...env, PORT: String(port) },
		stdio: "ignore",
	});
	return { child, url: `http://127.0.0.1:${port}/health` };
}

async function untilUp(url: string, timeoutMs = 10_000): Promise<number> {
	const started = performance.now();
	while (performance.now() - started < timeoutMs) {
		try {
			if ((await fetch(url)).ok) return performance.now() - started;
		} catch {}
		await new Promise((r) => setTimeout(r, 2));
	}
	throw new Error(`${url} did not come up within ${timeoutMs} ms`);
}

async function stop(child: ChildProcess): Promise<void> {
	if (child.exitCode !== null) return;
	await new Promise<void>((resolve) => {
		child.once("exit", () => resolve());
		child.kill("SIGTERM");
	});
}

/** Mean milliseconds per sequential request. */
async function meanRequestMs(url: string): Promise<number> {
	for (let i = 0; i < 200; i++) await (await fetch(url)).arrayBuffer(); // warm up
	const started = performance.now();
	for (let i = 0; i < REQUESTS; i++) await (await fetch(url)).arrayBuffer();
	return (performance.now() - started) / REQUESTS;
}

async function requestOverhead(appDir: string, baselineDir: string): Promise<number> {
	const diffs: number[] = [];
	for (let i = 0; i < RUNS; i++) {
		const tatara = start(appDir, "dist/apps/api/server.mjs", PROD_ENV);
		const plain = start(baselineDir, "src/server.mjs", {});
		await Promise.all([untilUp(tatara.url), untilUp(plain.url)]);
		diffs.push((await meanRequestMs(tatara.url)) - (await meanRequestMs(plain.url)));
		await Promise.all([stop(tatara.child), stop(plain.child)]);
	}
	return median(diffs);
}

async function coldBoot(appDir: string): Promise<number> {
	const samples: number[] = [];
	for (let i = 0; i < RUNS; i++) {
		const server = start(appDir, "dist/apps/api/server.mjs", PROD_ENV);
		samples.push(await untilUp(server.url));
		await stop(server.child);
	}
	return median(samples);
}

function dirSizeKb(dir: string): number {
	let bytes = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
		if (entry.isFile()) bytes += statSync(join(entry.parentPath, entry.name)).size;
	}
	return bytes / 1024;
}

/** null while @tatara/core and @tatara/http don't exist yet. */
function corePackagesKb(): number | null {
	const dists = ["core", "http"].map((p) => join(ROOT, "packages", p, "dist"));
	if (!dists.every((d) => existsSync(d))) return null;
	return dists.reduce((sum, d) => sum + dirSizeKb(d), 0);
}

async function sync100(appDir: string): Promise<number> {
	const copy = join(WORK, "sync100");
	rmSync(copy, { recursive: true, force: true });
	cpSync(appDir, copy, { recursive: true, verbatimSymlinks: true });
	for (let i = 0; i < 100; i++) {
		const m = `mod${i}`;
		mkdirSync(join(copy, "src/modules", m, "routes"), { recursive: true });
		mkdirSync(join(copy, "src/modules", m, "commands"), { recursive: true });
		writeFileSync(
			join(copy, "src/modules", m, "routes", `${m}.routes.ts`),
			`import { createRouter, defineRoutes } from "#core/http/routes";\n\nconst router = createRouter();\nrouter.get("/", (c) => c.json({ ok: true }));\n\nexport default defineRoutes({ app: "api", basePath: "/${m}", router });\n`,
		);
		writeFileSync(
			join(copy, "src/modules", m, "commands", `${m}.ts`),
			`import { defineCommand } from "@tatara/core";\n\nexport default defineCommand({ name: "${m}:run", description: "${m}", run() {} });\n`,
		);
	}
	const samples: number[] = [];
	for (let i = 0; i < RUNS; i++) {
		const started = performance.now();
		const res = await run("node", ["node_modules/@tatara/cli/dist/bin.mjs", "sync", "--quiet"], {
			cwd: copy,
		});
		if (res.code !== 0) throw new Error(`tatara sync failed: ${res.out.slice(-500)}`);
		samples.push(performance.now() - started);
	}
	return median(samples);
}

async function main() {
	const json = process.argv.includes("--json");
	const budgets = JSON.parse(readFileSync(join(ROOT, "bench", "budgets.json"), "utf8")) as Budgets;
	mkdirSync(WORK, { recursive: true });

	const packed = await packCli(WORK);
	const librarySpecs = await packLibraries(WORK);
	const appDir = join(WORK, "app");
	rmSync(appDir, { recursive: true, force: true });
	await generateApp(
		packed,
		appDir,
		["--orm", "none", "--db", "none", "--auth", "none", "--pm", "pnpm"],
		librarySpecs,
	);
	const built = await run("pnpm", ["run", "build"], { cwd: appDir });
	if (built.code !== 0) throw new Error(`app build failed: ${built.out.slice(-500)}`);

	const baselineDir = join(WORK, "baseline-app");
	rmSync(baselineDir, { recursive: true, force: true });
	cpSync(join(ROOT, "bench", "baseline-app"), baselineDir, { recursive: true });
	const installed = await run("pnpm", ["install", "--ignore-workspace"], { cwd: baselineDir });
	if (installed.code !== 0)
		throw new Error(`baseline install failed: ${installed.out.slice(-500)}`);

	const results: Record<keyof Budgets, number | null> = {
		requestOverheadMs: await requestOverhead(appDir, baselineDir),
		coldBootMs: await coldBoot(appDir),
		corePackagesKb: corePackagesKb(),
		sync100Ms: await sync100(appDir),
	};

	const rows = (Object.keys(budgets) as (keyof Budgets)[]).map((key) => {
		const value = results[key];
		const ok = value === null || value <= budgets[key];
		return { key, value, budget: budgets[key], ok };
	});
	if (json) console.log(JSON.stringify(rows, null, 2));
	else {
		for (const r of rows) {
			const value =
				r.value === null ? "n/a" : r.value.toFixed(r.key === "requestOverheadMs" ? 3 : 0);
			console.log(
				`${r.ok ? "✔" : "✖"} ${r.key.padEnd(18)} ${value.padStart(9)}  (budget ${r.budget})`,
			);
		}
	}
	if (rows.some((r) => !r.ok)) process.exitCode = 1;
}

await main();
