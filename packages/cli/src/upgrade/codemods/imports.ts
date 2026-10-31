const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The names `text` imports (or re-exports) from `specifier`, or null when it doesn't use it.
 * A namespace, default, side-effect or dynamic import gives ["*"]: it could reach any name.
 */
export function importsOf(text: string, specifier: string): string[] | null {
	const spec = `["']${escapeRegExp(specifier)}["']`;
	const names: string[] = [];
	let found = false;
	const fromClause = new RegExp(
		`(?:import|export)\\s+(?:type\\s+)?([^;]*?)\\s+from\\s+${spec}`,
		"g",
	);
	for (const match of text.matchAll(fromClause)) {
		found = true;
		const braces = (match[1] ?? "").match(/^\{([^}]*)\}$/);
		if (!braces) {
			names.push("*");
			continue;
		}
		for (const part of (braces[1] ?? "").split(",")) {
			const name = part
				.trim()
				.replace(/^type\s+/, "")
				.split(/\s+as\s+/)[0]
				?.trim();
			if (name) names.push(name);
		}
	}
	if (new RegExp(`import\\s*\\(\\s*${spec}\\s*\\)|import\\s+${spec}`).test(text)) {
		found = true;
		names.push("*");
	}
	return found ? names : null;
}
