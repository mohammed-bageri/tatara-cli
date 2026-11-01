/** @tatara/core: commands (and deploy), lifecycle, readiness, logger options, env, crypto and text helpers. */
import { createLifecycle } from "./lifecycle.ts";
import { createReadiness } from "./readiness.ts";

export {
	type CommandContext,
	type CommandDefinition,
	type CommandLedger,
	defineCommand,
	flag,
	noArgs,
	parseFlags,
	runCommand,
	runDeploy,
} from "./commands.ts";
export { createLocalDefault } from "./config.ts";
export {
	CODE_ALPHABET,
	createEncryption,
	type Encryption,
	hashToken,
	numericCode,
	randomCode,
	randomToken,
	safeEqual,
} from "./crypto.ts";
export { createLifecycle, type LifecycleOptions } from "./lifecycle.ts";
export { type CoreLogger, type LoggerConfig, levelToSeverity, loggerOptions } from "./logger.ts";
export { createReadiness } from "./readiness.ts";
export { type CleanTextOptions, cleanText, safeUrl, text, url } from "./sanitize.ts";

// the app-wide instances; creating them only allocates state
const lifecycle = createLifecycle();
const readiness = createReadiness();
export const { onShutdown, waitUntil, shutdown, handleSignals } = lifecycle;
export const { registerReadinessCheck, runReadinessChecks } = readiness;
