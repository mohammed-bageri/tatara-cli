import { runCommand, shutdown } from "@tatara/core";
import { logger } from "#core/logging/logger";
import { commands } from "#generated/commands";

const code = await runCommand(commands, process.argv.slice(2), logger);
await shutdown(code, logger);
