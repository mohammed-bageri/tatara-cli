import type { UserConfig } from "tsdown";

/** Build settings shared by every @tatara/* library package. */
export function libraryConfig(entry: Record<string, string>): UserConfig {
	return {
		entry,
		format: "esm",
		platform: "node",
		target: "node24",
		outDir: "dist",
		dts: true,
		clean: true,
	};
}
