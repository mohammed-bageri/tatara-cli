import { defineConfig } from "tsdown";
import { libraryConfig } from "../../tsdown.base.ts";

export default defineConfig(
	libraryConfig({
		index: "src/index.ts",
		bullmq: "src/bullmq.ts",
		postgres: "src/postgres.ts",
		kafka: "src/kafka.ts",
		commands: "src/commands.ts",
	}),
);
