import { runCommand } from "#core/commands/runner";
import { shutdown } from "#core/process/lifecycle";
import { commands } from "#generated/commands";

const code = await runCommand(commands, process.argv.slice(2));
await shutdown(code);
