import { runCommand, shutdown } from "@tatara/core";
import { logger } from "#core/logging/logger";
import { commands } from "#generated/commands";
// tatara:slot imports

const code = await runCommand(commands, process.argv.slice(2), logger, {
	// tatara:slot options
});
await shutdown(code, logger);
