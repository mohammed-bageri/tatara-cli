import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		"apps/api/server": "src/apps/api/server.ts",
		"apps/cli/index": "src/apps/cli/index.ts",
		// tatara:slot entries
	},
	format: "esm",
	platform: "node",
	target: "node24",
	outDir: "dist",
	dts: false,
	clean: true,
});
