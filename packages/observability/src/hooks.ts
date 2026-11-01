/**
 * Lets OpenTelemetry patch the ES modules the app imports after this. Imports nothing of the SDK:
 * it has to run before the libraries it instruments are loaded.
 */
import { register } from "node:module";

interface SyncHooks {
	register(): void;
	supportsSyncHooks(): boolean;
}

/** In-thread hooks (module.registerHooks) where Node has them, else the loader thread. */
export async function registerInstrumentationHooks(): Promise<void> {
	const hooks = (await import(
		// ships types under a name TypeScript doesn't pair with the .mjs
		"import-in-the-middle/register-hooks.mjs" as string
	)) as SyncHooks;
	if (hooks.supportsSyncHooks()) hooks.register();
	else register("@opentelemetry/instrumentation/hook.mjs", import.meta.url);
}
