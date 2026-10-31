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

type SecurityScheme = Record<string, { type?: string; scheme?: string }>;

/** Computes the access label for a route based on its security requirements. */
export function parseAccessLabel(
	security: Array<Record<string, string[]>> | undefined,
	_securitySchemes: SecurityScheme,
	tags: string[] = [],
): string {
	// Routes tagged "Auth" are from better-auth's merged document
	if (tags.includes("Auth")) return "better-auth";

	if (!security || security.length === 0) return "public";

	const labels: string[] = [];
	for (const requirement of security) {
		const schemes = Object.keys(requirement);
		if (schemes.length === 0) continue;

		const schemeName = schemes[0] ?? "";
		const roles = requirement[schemeName] ?? [];

		// For bearer auth with specific roles, show the roles
		if (schemeName === "bearerAuth" && roles.length > 0) {
			labels.push(roles.join(", "));
		}
		// For bearer auth without roles, show "authenticated"
		else if (schemeName === "bearerAuth") {
			labels.push("authenticated");
		}
		// For other schemes (API keys, etc.), show the scheme name
		else {
			labels.push(schemeName);
		}
	}

	return labels.length > 1 ? labels.join(" OR ") : (labels[0] ?? "authenticated");
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
	// Fetch from /openapi.json endpoint to get the document with all extensions applied
	const res = await app.request("/openapi.json");
	const doc = await res.json();
	const securitySchemes = doc.components?.securitySchemes ?? {};

	for (const [path, item] of Object.entries(doc.paths ?? {})) {
		for (const [method, op] of Object.entries(item)) {
			const tags = op.tags ?? [];
			const security = op.security ?? [];

			// Parse access label based on security schemes and tags
			let access = "public";

			// Routes tagged "Auth" are from better-auth's merged document
			if (tags.includes("Auth")) {
				access = "better-auth";
			} else if (security.length > 0) {
				const labels = [];
				for (const requirement of security) {
					const schemes = Object.keys(requirement);
					if (schemes.length === 0) continue;

					const schemeName = schemes[0];
					const roles = requirement[schemeName] ?? [];

					// For bearer auth with specific roles, show the roles
					if (schemeName === "bearerAuth" && roles.length > 0) {
						labels.push(roles.join(", "));
					}
					// For bearer auth without roles, show "authenticated"
					else if (schemeName === "bearerAuth") {
						labels.push("authenticated");
					}
					// For other schemes (API keys, etc.), show the scheme name
					else {
						labels.push(schemeName);
					}
				}
				access = labels.length > 1 ? labels.join(" OR ") : (labels[0] ?? "authenticated");
			}

			const summary = op.summary || op.description || "";
			out.push({ app: name, method: method.toUpperCase(), path, summary, access });
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
