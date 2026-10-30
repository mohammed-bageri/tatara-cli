/** @tatara/core: commands, flags, lifecycle, readiness, logger options and env helpers. */
import { createLifecycle } from "./lifecycle.ts";
import { createReadiness } from "./readiness.ts";

export {
	type CommandContext,
	type CommandDefinition,
	defineCommand,
	flag,
	noArgs,
	parseFlags,
	runCommand,
} from "./commands.ts";
export { createLocalDefault } from "./config.ts";
export { createLifecycle, type LifecycleOptions } from "./lifecycle.ts";
export { type CoreLogger, type LoggerConfig, levelToSeverity, loggerOptions } from "./logger.ts";
export { createReadiness } from "./readiness.ts";

// the app-wide instances; creating them only allocates state
const lifecycle = createLifecycle();
const readiness = createReadiness();
export const { onShutdown, waitUntil, shutdown, handleSignals } = lifecycle;
export const { registerReadinessCheck, runReadinessChecks } = readiness;
