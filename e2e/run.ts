/**
 * End-to-end matrix: generate each app from the packed CLI, verify it, boot it, smoke-test every
 * feature it has, run the generators, verify again. Usage:
 *   node e2e/run.ts [--only a,b] [--parallel 2] [--keep] [--list]
 */
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseEnv } from "node:util";
import { SCENARIOS, type Scenario } from "./scenarios.ts";

const ROOT = resolve(import.meta.dirname, "..");
const WORK = join(ROOT, ".e2e");
const RUNS = join(WORK, "runs");
const CLI = join(ROOT, "packages/cli");

interface StepResult {
	step: string;
	ok: boolean;
	ms: number;
	detail?: string;
}

interface ScenarioResult {
	name: string;
	ok: boolean;
	ms: number;
	steps: StepResult[];
}

function args() {
	const argv = process.argv.slice(2);
	const get = (flag: string) => {
		const i = argv.indexOf(flag);
		return i >= 0 ? argv[i + 1] : undefined;
	};
	return {
		only: get("--only")?.split(","),
		parallel: Number(get("--parallel") ?? "1"),
		keep: argv.includes("--keep"),
		list: argv.includes("--list"),
	};
}

function run(
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

/** Moves every local port by `offset` and gives the compose project a unique name. */
function remapPorts(dir: string, offset: number, project: string) {
	const ports = ["5432", "3306", "6379", "9000", "9001", "1025", "8025", "8080", "3000", "3001"];
	for (const file of [".env", ".env.test"]) {
		const path = join(dir, file);
		if (!existsSync(path)) continue;
		let text = readFileSync(path, "utf8");
		for (const port of ports) {
			const next = String(Number(port) + offset);
			text = text.replace(new RegExp(`(localhost:)${port}\\b`, "g"), `$1${next}`);
			text = text.replace(
				new RegExp(
					`^((?:DB|REDIS|STORAGE|STORAGE_CONSOLE|MAILPIT_SMTP|MAILPIT_UI|KEYCLOAK|ADMIN)_PORT|PORT)=${port}$`,
					"gm",
				),
				`$1=${next}`,
			);
		}
		if (file === ".env") text += `COMPOSE_PROJECT_NAME=${project}\n`;
		writeFileSync(path, text);
	}
}

function envOf(dir: string): Record<string, string> {
	return parseEnv(readFileSync(join(dir, ".env"), "utf8")) as Record<string, string>;
}

async function waitFor(url: string, timeoutMs = 30_000): Promise<boolean> {
	const end = Date.now() + timeoutMs;
	while (Date.now() < end) {
		try {
			const res = await fetch(url);
			if (res.ok) return true;
		} catch {}
		await new Promise((r) => setTimeout(r, 300));
	}
	return false;
}

class Check extends Error {}

function expect(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Check(message);
}

async function json(res: Response): Promise<Record<string, unknown>> {
	const text = await res.text();
	try {
		return JSON.parse(text) as Record<string, unknown>;
	} catch {
		return { raw: text };
	}
}

const BROWSER = { "content-type": "application/json", origin: "http://localhost:5173" };

/** A bearer token for a fresh user (and, with `admin`, for the seeded admin). */
async function tokenFor(
	s: Scenario,
	base: string,
	dir: string,
	who: "user" | "admin",
): Promise<string | undefined> {
	if (s.auth === "none") return undefined;
	if (s.auth === "keycloak") {
		const out = await run(
			"node",
			[
				"--env-file=.env",
				"dist/apps/cli/index.mjs",
				"keycloak:token",
				"--user",
				who === "admin" ? "alice" : "bob",
			],
			{ cwd: dir },
		);
		const token = out.out.trim().split("\n").at(-1) ?? "";
		expect(
			out.code === 0 && token.split(".").length === 3,
			`keycloak:token failed: ${out.out.slice(-300)}`,
		);
		return token;
	}
	const methods = s.authMethods ?? [];
	const env = envOf(dir);
	const email =
		who === "admin"
			? (env.SEED_ADMIN_EMAIL ?? "admin@example.com")
			: `e2e-${Date.now()}@example.com`;
	if (methods.includes("email-otp")) {
		await fetch(`${base}/api/auth/email-otp/send-verification-otp`, {
			method: "POST",
			headers: BROWSER,
			body: JSON.stringify({ email, type: "sign-in" }),
		});
		const outbox = await json(
			await fetch(`${base}/api/dev/outbox?to=${encodeURIComponent(email)}`),
		);
		const code = (outbox.messages as { code?: string }[] | undefined)?.[0]?.code;
		expect(code, "no OTP in the dev outbox");
		const res = await fetch(`${base}/api/auth/sign-in/email-otp`, {
			method: "POST",
			headers: BROWSER,
			body: JSON.stringify({ email, otp: code }),
		});
		const token = res.headers.get("set-auth-token");
		expect(res.ok && token, `email OTP sign-in failed (${res.status})`);
		return token;
	}
	if (methods.includes("password")) {
		const password = who === "admin" ? env.SEED_ADMIN_PASSWORD : "correct-horse-battery-staple";
		if (who === "user") {
			const signUp = await fetch(`${base}/api/auth/sign-up/email`, {
				method: "POST",
				headers: BROWSER,
				body: JSON.stringify({ email, password, name: "E2E" }),
			});
			expect(signUp.ok, `sign-up failed (${signUp.status})`);
		}
		const res = await fetch(`${base}/api/auth/sign-in/email`, {
			method: "POST",
			headers: BROWSER,
			body: JSON.stringify({ email, password }),
		});
		const token = res.headers.get("set-auth-token");
		expect(res.ok && token, `password sign-in failed (${res.status})`);
		return token;
	}
	expect(who === "user", "admin sign-in needs email-otp or password");
	const phone = `+1555${String(Date.now()).slice(-7)}`;
	await fetch(`${base}/api/auth/phone-number/send-otp`, {
		method: "POST",
		headers: BROWSER,
		body: JSON.stringify({ phoneNumber: phone }),
	});
	const outbox = await json(await fetch(`${base}/api/dev/outbox?to=${encodeURIComponent(phone)}`));
	const code = (outbox.messages as { code?: string }[] | undefined)?.[0]?.code;
	expect(code, "no SMS code in the dev outbox");
	const res = await fetch(`${base}/api/auth/phone-number/verify`, {
		method: "POST",
		headers: BROWSER,
		body: JSON.stringify({ phoneNumber: phone, code }),
	});
	const token = res.headers.get("set-auth-token");
	expect(res.ok && token, `phone sign-in failed (${res.status})`);
	return token;
}

function start(dir: string, file: string, log: string): ChildProcess {
	const child = spawn("node", ["--env-file=.env", file], {
		cwd: dir,
		env: { ...process.env, FORCE_COLOR: "0" },
	});
	child.stdout?.on("data", (d: Buffer) => writeFileSync(log, d, { flag: "a" }));
	child.stderr?.on("data", (d: Buffer) => writeFileSync(log, d, { flag: "a" }));
	return child;
}

async function smoke(s: Scenario, dir: string, logDir: string): Promise<string[]> {
	const notes: string[] = [];
	const env = envOf(dir);
	const base = `http://localhost:${env.PORT}`;
	const children: ChildProcess[] = [
		start(dir, "dist/apps/api/server.mjs", join(logDir, "api.log")),
	];
	try {
		expect(await waitFor(`${base}/health`), "API did not start");
		const ready = await json(await fetch(`${base}/ready`));
		expect(ready.ready === true, `not ready: ${JSON.stringify(ready)}`);
		expect((await fetch(`${base}/docs`)).ok, "/docs failed");
		const spec = await json(await fetch(`${base}/openapi.json`));
		expect(Object.keys((spec.paths as object) ?? {}).length > 0, "OpenAPI has no paths");
		expect((await fetch(`${base}/api/greetings?name=E2E`)).ok, "greetings failed");

		const user = await tokenFor(s, base, dir, "user");
		const auth = (token?: string): Record<string, string> =>
			token
				? { authorization: `Bearer ${token}`, "content-type": "application/json" }
				: { "content-type": "application/json" };
		if (user) {
			const me = await json(await fetch(`${base}/api/me`, { headers: auth(user) }));
			expect(
				(me.data as { userId?: string } | undefined)?.userId,
				`/api/me failed: ${JSON.stringify(me)}`,
			);
			expect((await fetch(`${base}/api/me`)).status === 401, "/api/me without token was not 401");
			notes.push("auth");
		}

		let crudToken = user;
		if (s.addons.includes("authz") && user) {
			const admin =
				s.authMethods?.includes("orgs") || s.auth === "keycloak"
					? await tokenFor(s, base, dir, "admin")
					: undefined;
			if (admin) crudToken = admin;
			else {
				const me = await json(await fetch(`${base}/api/me`, { headers: auth(user) }));
				const userId = (me.data as { userId: string }).userId;
				const grant = await run(
					"node",
					[
						"--env-file=.env",
						"dist/apps/cli/index.mjs",
						"authz:grant-role",
						"--user",
						userId,
						"--role",
						"admin",
					],
					{ cwd: dir },
				);
				expect(grant.code === 0, `authz:grant-role failed: ${grant.out.slice(-300)}`);
			}
			const perms = await json(
				await fetch(`${base}/api/authorization/me`, { headers: auth(crudToken) }),
			);
			expect(
				(perms.data as { roles?: string[] } | undefined)?.roles?.includes("admin"),
				`authorization/me: ${JSON.stringify(perms)}`,
			);
			expect(
				(await fetch(`${base}/api/authorization/roles`, { headers: auth(crudToken) })).ok,
				"roles list failed",
			);
			if (crudToken !== user) {
				expect(
					(await fetch(`${base}/api/projects`, { headers: auth(user) })).status === 403,
					"plain user was not 403",
				);
			}
			notes.push("authz");
		}

		if (s.database !== "none") {
			if (user)
				expect(
					(await fetch(`${base}/api/projects`)).status === 401,
					"projects without token was not 401",
				);
			const created = await fetch(`${base}/api/projects`, {
				method: "POST",
				headers: auth(crudToken),
				body: JSON.stringify({ name: "E2E project" }),
			});
			const body = await json(created);
			expect(created.status === 201, `create project: ${created.status} ${JSON.stringify(body)}`);
			const id = (body.data as { id: string }).id;
			const list = await json(await fetch(`${base}/api/projects`, { headers: auth(crudToken) }));
			expect((list.meta as { total: number }).total >= 1, "project list empty");
			const removed = await fetch(`${base}/api/projects/${id}`, {
				method: "DELETE",
				headers: auth(crudToken),
			});
			expect(removed.status === 204, `delete project: ${removed.status}`);
			notes.push("crud");
		}

		if (s.addons.includes("i18n")) {
			const res = await json(
				await fetch(`${base}/api/greetings?name=${"x".repeat(60)}`, {
					headers: { "accept-language": "ar" },
				}),
			);
			expect(res.error === "الطلب غير صالح", `i18n: ${JSON.stringify(res)}`);
			notes.push("i18n");
		}

		if (s.addons.includes("admin")) {
			const adminBase = `http://localhost:${env.ADMIN_PORT}`;
			children.push(start(dir, "dist/apps/admin/server.mjs", join(logDir, "admin.log")));
			expect(await waitFor(`${adminBase}/health`), "admin app did not start");
			expect(
				(await fetch(`${adminBase}/api/greetings`)).status === 401,
				"admin without token was not 401",
			);
			const adminToken = await tokenFor(s, base, dir, "admin");
			const res = await fetch(`${adminBase}/api/greetings`, { headers: auth(adminToken) });
			expect(res.status === 200, `admin with admin token: ${res.status}`);
			notes.push("admin");
		}

		if (s.addons.includes("storage")) {
			const res = await run(
				"node",
				["--env-file=.env", "dist/apps/cli/index.mjs", "storage:check"],
				{ cwd: dir },
			);
			expect(
				res.code === 0 && res.out.includes("storage OK"),
				`storage:check: ${res.out.slice(-400)}`,
			);
			notes.push("storage");
		}

		if (s.addons.includes("email")) {
			const res = await run(
				"node",
				[
					"--env-file=.env",
					"dist/apps/cli/index.mjs",
					"email:send-test",
					"--to",
					"e2e@example.com",
				],
				{ cwd: dir },
			);
			expect(res.code === 0, `email:send-test: ${res.out.slice(-400)}`);
			const box = await json(
				await fetch(`http://localhost:${env.MAILPIT_UI_PORT}/api/v1/messages`),
			);
			expect(Number(box.total) >= 1, "Mailpit received nothing");
			notes.push("email");
		}

		if (s.addons.includes("jobs")) {
			const workerLog = join(logDir, "worker.log");
			children.push(start(dir, "dist/apps/worker/index.mjs", workerLog));
			children.push(start(dir, "dist/apps/cron/index.mjs", join(logDir, "cron.log")));
			const queued = await run(
				"node",
				[
					"--env-file=.env",
					"dist/apps/cli/index.mjs",
					"jobs:enqueue",
					"--topic",
					"example.send-welcome",
					"--data",
					'{"name":"E2E"}',
				],
				{ cwd: dir },
			);
			expect(queued.code === 0, `jobs:enqueue: ${queued.out.slice(-300)}`);
			const end = Date.now() + 15_000;
			let handled = false;
			while (Date.now() < end && !handled) {
				await new Promise((r) => setTimeout(r, 300));
				handled = existsSync(workerLog) && readFileSync(workerLog, "utf8").includes("welcome sent");
			}
			expect(handled, "worker did not process the job");
			expect(
				readFileSync(join(logDir, "cron.log"), "utf8").includes("cron started"),
				"cron did not start",
			);
			notes.push("jobs");
		}
	} finally {
		for (const child of children) child.kill("SIGTERM");
		await new Promise((r) => setTimeout(r, 500));
	}
	return notes;
}

const GENERATORS: { kind: string; name: string; when?: (s: Scenario) => boolean }[] = [
	{ kind: "module", name: "billing" },
	{ kind: "route", name: "report" },
	{ kind: "service", name: "pricing" },
	{ kind: "command", name: "recalculate" },
	{ kind: "resource", name: "invoice", when: (s) => s.database !== "none" },
	{ kind: "schema", name: "line-item", when: (s) => s.database !== "none" },
	{ kind: "consumer", name: "invoice-paid", when: (s) => s.addons.includes("jobs") },
	{ kind: "schedule", name: "nightly-close", when: (s) => s.addons.includes("jobs") },
	{ kind: "permission", name: "ledger", when: (s) => s.addons.includes("authz") },
];

async function runScenario(
	s: Scenario,
	slot: number,
	packed: string,
	keep: boolean,
): Promise<ScenarioResult> {
	const started = Date.now();
	const dir = join(RUNS, s.name);
	const logDir = join(WORK, "logs", s.name);
	const project = `tatara-e2e-${s.name}`;
	const steps: StepResult[] = [];
	const pmRun = s.pm === "npm" ? ["npm", "run"] : [s.pm, "run"];
	const pathEnv =
		s.pm === "bun" ? { PATH: `${join(WORK, "tools/node_modules/.bin")}:${process.env.PATH}` } : {};
	const tatara = join(dir, "node_modules/.bin/tatara");

	if (existsSync(dir)) {
		await run("docker", ["compose", "down", "--volumes", "--remove-orphans"], { cwd: dir });
		rmSync(dir, { recursive: true, force: true });
	}
	rmSync(logDir, { recursive: true, force: true });
	mkdirSync(logDir, { recursive: true });
	mkdirSync(RUNS, { recursive: true });

	const step = async (name: string, fn: () => Promise<string | undefined | void>) => {
		const t = Date.now();
		try {
			const detail = (await fn()) ?? undefined;
			steps.push({ step: name, ok: true, ms: Date.now() - t, ...(detail ? { detail } : {}) });
			return true;
		} catch (error) {
			steps.push({
				step: name,
				ok: false,
				ms: Date.now() - t,
				detail: (error as Error).message.slice(0, 1500),
			});
			return false;
		}
	};
	const sh = async (cmd: string, cmdArgs: string[], label: string, env: NodeJS.ProcessEnv = {}) => {
		const res = await run(cmd, cmdArgs, {
			cwd: dir,
			env: { ...pathEnv, ...env },
			log: join(logDir, `${label}.log`),
		});
		if (res.code !== 0) throw new Error(`${label} exited ${res.code}:\n${res.out.slice(-1200)}`);
		return res.out;
	};

	const ok =
		(await step("new", async () => {
			const res = await run(
				"node",
				[join(CLI, "dist/bin.mjs"), "new", dir, ...s.flags, "--yes", "--no-git"],
				{
					cwd: RUNS,
					env: { ...pathEnv, TATARA_CLI_SPEC: `file:${packed}` },
					log: join(logDir, "new.log"),
				},
			);
			if (res.code !== 0) throw new Error(res.out.slice(-1500));
			if (res.out.includes("Formatting reported problems"))
				throw new Error(`formatting problems:\n${res.out.slice(-1500)}`);
			remapPorts(dir, 10_000 + slot * 100, project);
		})) &&
		(await step("services", async () => {
			if (!existsSync(join(dir, "compose.yaml"))) return "none";
			await sh("docker", ["compose", "up", "--detach", "--wait"], "compose-up");
		})) &&
		(await step("verify", async () => {
			await sh(pmRun[0] ?? "pnpm", [...pmRun.slice(1), "verify"], "verify");
		})) &&
		(await step("dev --prepare", async () => {
			await sh(tatara, ["dev", "--prepare"], "prepare");
		})) &&
		(await step("smoke", async () => (await smoke(s, dir, logDir)).join(", "))) &&
		(await step("routes + doctor", async () => {
			const routes = JSON.parse(await sh(tatara, ["routes", "--json"], "routes")) as unknown[];
			if (routes.length === 0) throw new Error("no routes listed");
			const doctor = JSON.parse(await sh(tatara, ["doctor", "--json"], "doctor")) as {
				name: string;
				ok: boolean;
				detail: string;
			}[];
			const failed = doctor.filter((c) => !c.ok);
			if (failed.length) throw new Error(`doctor: ${JSON.stringify(failed)}`);
			return `${routes.length} routes`;
		})) &&
		(await step("generators", async () => {
			const made: string[] = [];
			for (const g of GENERATORS) {
				if (g.when && !g.when(s)) continue;
				await sh(
					tatara,
					["make", g.kind, g.name, ...(g.kind === "module" ? [] : ["--module", "billing"])],
					`make-${g.kind}`,
				);
				made.push(g.kind);
			}
			const dry = await sh(
				tatara,
				["make", "service", "pricing", "--module", "billing", "--dry-run"],
				"make-dry",
			).catch((e: Error) => e.message);
			if (!dry.includes("Refusing to overwrite"))
				throw new Error("generator overwrote or did not refuse an existing file");
			if (s.database !== "none")
				await sh(tatara, ["db", "generate", "--name", "billing"], "db-generate");
			return made.join(", ");
		})) &&
		(await step("verify after generators", async () => {
			await sh(pmRun[0] ?? "pnpm", [...pmRun.slice(1), "verify"], "verify-2");
		}));

	if (!keep) {
		await run("docker", ["compose", "down", "--volumes", "--remove-orphans"], { cwd: dir });
		if (ok) rmSync(dir, { recursive: true, force: true });
	} else {
		await run("docker", ["compose", "down"], { cwd: dir });
	}
	return { name: s.name, ok, ms: Date.now() - started, steps };
}

async function main() {
	const options = args();
	const scenarios = SCENARIOS.filter((s) => !options.only || options.only.includes(s.name));
	if (options.list) {
		for (const s of SCENARIOS) console.log(`${s.name.padEnd(28)} ${s.flags.join(" ")}`);
		return;
	}
	mkdirSync(WORK, { recursive: true });

	console.log("building and packing the CLI…");
	const build = await run("pnpm", ["--filter", "@tatara/cli", "run", "build"], { cwd: ROOT });
	if (build.code !== 0) throw new Error(build.out);
	const pkgDir = join(WORK, "pkg");
	rmSync(pkgDir, { recursive: true, force: true });
	mkdirSync(pkgDir, { recursive: true });
	const pack = await run("pnpm", ["pack", "--pack-destination", pkgDir], { cwd: CLI });
	if (pack.code !== 0) throw new Error(pack.out);
	const packed = join(pkgDir, readdirSync(pkgDir).find((f) => f.endsWith(".tgz")) ?? "");

	if (
		scenarios.some((s) => s.pm === "bun") &&
		!existsSync(join(WORK, "tools/node_modules/.bin/bun"))
	) {
		console.log("installing bun locally for bun scenarios…");
		await run("npm", ["install", "--prefix", join(WORK, "tools"), "bun"], { cwd: ROOT });
	}

	const results: ScenarioResult[] = [];
	const queue = [...scenarios];
	const workers = Array.from({ length: Math.max(1, options.parallel) }, async (_, slot) => {
		for (let s = queue.shift(); s; s = queue.shift()) {
			console.log(`▶ ${s.name}`);
			const result = await runScenario(s, slot, packed, options.keep);
			results.push(result);
			const failed = result.steps.find((x) => !x.ok);
			console.log(
				`${result.ok ? "✔" : "✖"} ${s.name} (${Math.round(result.ms / 1000)}s)${failed ? ` — ${failed.step}: ${failed.detail?.split("\n").slice(0, 6).join(" | ")}` : ""}`,
			);
		}
	});
	await Promise.all(workers);

	results.sort((a, b) => a.name.localeCompare(b.name));
	writeFileSync(join(WORK, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
	console.log("\nscenario                     result  time   steps");
	for (const r of results) {
		const steps = r.steps.map((x) => `${x.ok ? "✔" : "✖"}${x.step}`).join(" ");
		console.log(
			`${r.name.padEnd(28)} ${(r.ok ? "PASS" : "FAIL").padEnd(6)}  ${String(Math.round(r.ms / 1000)).padStart(4)}s  ${steps}`,
		);
	}
	const failed = results.filter((r) => !r.ok).length;
	console.log(`\n${results.length - failed}/${results.length} passed`);
	if (failed > 0) process.exitCode = 1;
}

await main();
