import { defineConfig } from "tsdown";
import { libraryConfig } from "../../tsdown.base.ts";

export default defineConfig(
	libraryConfig({ index: "src/index.ts", redis: "src/redis.ts", postgres: "src/postgres.ts" }),
);
