import { defineConfig } from "tsdown";

export default defineConfig({
	entry: { index: "src/index.ts" },
	format: "esm",
	platform: "node",
	target: "node24",
	outDir: "dist",
	dts: false,
	clean: true,
});
