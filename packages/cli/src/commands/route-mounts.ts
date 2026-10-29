import type { Violation } from "./check.ts";

const ROUTE_FILE = /\/routes\/[^/]+\.routes\.ts$/;
const DEFINE_ROUTES = /defineRoutes\(\s*\{([^}]*)\}/;

function lineOf(text: string, index: number): number {
	return text.slice(0, index).split("\n").length;
}

/** Route files that mount on an app + basePath already taken by an earlier file (sorted by path). */
export function routeMountCollisions(sources: ReadonlyMap<string, string>): Violation[] {
	const owners = new Map<string, string>();
	const violations: Violation[] = [];
	for (const file of [...sources.keys()].sort()) {
		if (!ROUTE_FILE.test(file)) continue;
		const text = sources.get(file) ?? "";
		const call = DEFINE_ROUTES.exec(text);
		const app = call && /\bapp:\s*["']([^"']+)["']/.exec(call[1] ?? "")?.[1];
		const basePath = call && /\bbasePath:\s*["']([^"']+)["']/.exec(call[1] ?? "")?.[1];
		if (!call || !app || !basePath) continue;
		const key = `${app} "${basePath}"`;
		const owner = owners.get(key);
		if (owner) {
			violations.push({
				file,
				line: lineOf(text, call.index),
				rule: "duplicate-base-path",
				message: `${key} is already mounted by ${owner}; routers on one base path shadow each other, so give this one its own basePath`,
			});
		} else {
			owners.set(key, file);
		}
	}
	return violations;
}
