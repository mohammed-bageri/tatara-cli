import type { ProjectConfig } from "./config.ts";

/** Packages the app ejected (`tatara eject`); their code lives in src/ejected/<name>. */
export function ejectedPackages(config: ProjectConfig): string[] {
	return Object.keys(config.ejected ?? {});
}

/** Points `@tatara/<name>` and `@tatara/<name>/<entry>` imports at the app's ejected copy. */
export function pointAtEjected(text: string, names: string[]): string {
	if (names.length === 0) return text;
	const pattern = new RegExp(`(["'])@tatara/(${names.join("|")})(?:/([\\w-]+))?\\1`, "g");
	return text.replace(
		pattern,
		(_match, quote: string, name: string, entry?: string) =>
			`${quote}#ejected/${name}/${entry ?? "index"}${quote}`,
	);
}
