import { spawn } from "node:child_process";
import pc from "picocolors";
import type { Project } from "../project/config.ts";
import { NODE_FLAGS } from "./app-cli.ts";
import { sync } from "./sync.ts";

export interface RouteInfo {
	app: string;
	method: string;
	path: string;
	summary: string;
	access: string;
}

/** Reads every app's OpenAPI document in-process and lists its routes. */
export async function listRoutes(project: Project): Promise<RouteInfo[]> {
	await sync(project);
	const apps = [
		["api", "#apps/api/app"],
		...(project.has("admin") ? [["admin", "#apps/admin/app"]] : []),
	];
	const code = `
const out = [];
for (const [name, spec] of ${JSON.stringify(apps)}) {
	const { app } = await import(spec);
	const doc = app.getOpenAPI31Document({ openapi: "3.1.0", info: { title: name, version: "1" } });
	for (const [path, item] of Object.entries(doc.paths ?? {})) {
		for (const [method, op] of Object.entries(item)) {
			const security = op.security ?? [];
			const roles = security.flatMap((s) => Object.values(s).flat());
			const access = security.length === 0 ? "public" : roles.length ? roles.join(", ") : "authenticated";
			out.push({ app: name, method: method.toUpperCase(), path, summary: op.summary ?? "", access });
		}
	}
}
process.stdout.write(JSON.stringify(out));
process.exit(0);
`;
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [...NODE_FLAGS, "--input-type=module", "-e", code], {
			cwd: project.root,
			env: { ...process.env, LOG_LEVEL: "silent" },
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d: Buffer) => {
			stdout += d.toString();
		});
		child.stderr.on("data", (d: Buffer) => {
			stderr += d.toString();
		});
		child.on("exit", (code) => {
			if (code !== 0) return reject(new Error(`Could not load the apps:\n${stderr}`));
			resolve(JSON.parse(stdout) as RouteInfo[]);
		});
	});
}

export function printRoutes(routes: RouteInfo[]) {
	const rows = routes.map((r) => [r.app, r.method, r.path, r.access, r.summary]);
	const widths = [0, 1, 2, 3].map((i) => Math.max(...rows.map((r) => (r[i] ?? "").length), 4));
	for (const r of rows) {
		const [app = "", method = "", path = "", access = "", summary = ""] = r;
		console.log(
			`${pc.dim(app.padEnd(widths[0] ?? 0))}  ${pc.bold(method.padEnd(widths[1] ?? 0))}  ${path.padEnd(widths[2] ?? 0)}  ${(access === "public" ? pc.yellow : pc.green)(access.padEnd(widths[3] ?? 0))}  ${pc.dim(summary)}`,
		);
	}
}
