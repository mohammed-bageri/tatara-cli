import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

const env = existsSync(".env.test")
	? (parseEnv(readFileSync(".env.test", "utf8")) as Record<string, string>)
	: {};

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
		env,
		setupFiles: ["tests/setup.ts"],
		// tatara:slot vitest
	},
});
