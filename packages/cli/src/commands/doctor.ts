import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import pc from "picocolors";
import { x } from "tinyexec";
import type { Project } from "../project/config.ts";
import { check } from "./check.ts";

export interface DoctorCheck {
	name: string;
	ok: boolean;
	detail: string;
	fix?: string;
}

const PACKAGES: Record<string, string[]> = {
	drizzle: ["drizzle-orm", "drizzle-kit"],
	prisma: ["@prisma/client", "prisma"],
	"better-auth": ["better-auth"],
	keycloak: ["jose"],
	jobs: ["bullmq", "ioredis"],
};

export async function doctor(project: Project): Promise<DoctorCheck[]> {
	const checks: DoctorCheck[] = [];
	const add = (c: DoctorCheck) => checks.push(c);
	const major = Number(process.versions.node.split(".")[0]);
	add({
		name: "node",
		ok: major >= 24,
		detail: `v${process.versions.node}`,
		fix: "Install Node 24 or newer",
	});

	const pm = project.config.packageManager;
	const pmVersion = await x(pm, ["--version"], { throwOnError: false });
	add({
		name: pm,
		ok: pmVersion.exitCode === 0,
		detail: pmVersion.exitCode === 0 ? pmVersion.stdout.trim() : "not found",
		fix: pm === "pnpm" ? "corepack enable" : `Install ${pm}`,
	});

	if (existsSync(join(project.root, "compose.yaml"))) {
		const docker = await x("docker", ["info", "--format", "{{.ServerVersion}}"], {
			throwOnError: false,
		});
		add({
			name: "docker",
			ok: docker.exitCode === 0,
			detail: docker.exitCode === 0 ? docker.stdout.trim() : "daemon not reachable",
			fix: "Start Docker",
		});
		if (docker.exitCode === 0) {
			const ps = await x("docker", ["compose", "ps", "--format", "{{.Service}} {{.Health}}"], {
				nodeOptions: { cwd: project.root },
				throwOnError: false,
			});
			const lines = ps.stdout.trim().split("\n").filter(Boolean);
			const unhealthy = lines.filter((l) => !/ (healthy|)$/.test(l));
			add({
				name: "services",
				ok: lines.length > 0 && unhealthy.length === 0,
				detail: lines.length === 0 ? "not running" : lines.join(", "),
				fix: "Run `dev` to start them",
			});
		}
	}

	const envPath = join(project.root, ".env");
	if (!existsSync(envPath)) {
		add({ name: ".env", ok: false, detail: "missing", fix: "cp .env.example .env" });
	} else {
		const env = parseEnv(readFileSync(envPath, "utf8")) as Record<string, string>;
		const example = parseEnv(readFileSync(join(project.root, ".env.example"), "utf8")) as Record<
			string,
			string
		>;
		const missing = Object.keys(example).filter((k) => !(k in env));
		add({
			name: ".env",
			ok: missing.length === 0,
			detail: missing.length === 0 ? "matches .env.example" : `missing ${missing.join(", ")}`,
			fix: "Copy the missing keys from .env.example",
		});
	}

	const pkg = JSON.parse(readFileSync(join(project.root, "package.json"), "utf8")) as {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	};
	const installed = { ...pkg.dependencies, ...pkg.devDependencies };
	const expected = Object.entries(PACKAGES).flatMap(([feature, pkgs]) =>
		project.has(feature) ? pkgs : [],
	);
	const absent = expected.filter((p) => !(p in installed));
	add({
		name: "tatara.json",
		ok: absent.length === 0,
		detail:
			absent.length === 0 ? "matches package.json" : `package.json lacks ${absent.join(", ")}`,
		fix: "Reinstall the missing packages",
	});

	const violations = await check(project);
	add({
		name: "layout",
		ok: violations.length === 0,
		detail: violations.length === 0 ? "clean" : `${violations.length} violation(s)`,
		fix: "Run `tatara check` for details",
	});
	return checks;
}

export function printDoctor(checks: DoctorCheck[]) {
	for (const c of checks) {
		const mark = c.ok ? pc.green("✔") : pc.red("✖");
		console.log(
			`${mark} ${c.name.padEnd(12)} ${c.detail}${c.ok || !c.fix ? "" : pc.dim(`  → ${c.fix}`)}`,
		);
	}
}
