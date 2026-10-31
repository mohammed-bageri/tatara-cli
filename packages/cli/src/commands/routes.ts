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

type OpenApiDocument = {
	paths?: Record<
		string,
		Record<
			string,
			{
				tags?: string[];
				security?: Array<Record<string, string[]>>;
				summary?: string;
				description?: string;
			}
		>
	>;
	components?: { securitySchemes?: SecurityScheme };
};

/** Every app's OpenAPI document, as served at /openapi.json (with better-auth's merged in). */
export async function loadDocuments(project: Project): Promise<Record<string, OpenApiDocument>> {
	await sync(project);
	const apps = [
		["api", "#apps/api/app"],
		...(project.has("admin") ? [["admin", "#apps/admin/app"]] : []),
	];
	const code = `
const out = {};
for (const [name, spec] of ${JSON.stringify(apps)}) {
	const { app } = await import(spec);
	out[name] = await (await app.request("/openapi.json")).json();
}
// exit only once a large document has gone through the pipe
process.stdout.write(JSON.stringify(out), () => process.exit(0));
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
			resolve(JSON.parse(stdout) as Record<string, OpenApiDocument>);
		});
	});
}

/** Lists every app's routes with what protects them. */
export async function listRoutes(project: Project): Promise<RouteInfo[]> {
	const out: RouteInfo[] = [];
	for (const [app, doc] of Object.entries(await loadDocuments(project))) {
		const schemes = doc.components?.securitySchemes ?? {};
		for (const [path, item] of Object.entries(doc.paths ?? {})) {
			for (const [method, op] of Object.entries(item)) {
				out.push({
					app,
					method: method.toUpperCase(),
					path,
					summary: op.summary || op.description || "",
					access: parseAccessLabel(op.security, schemes, op.tags),
				});
			}
		}
	}
	return out;
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
