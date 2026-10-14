import { logger } from "#core/logging/logger";

type Hook = () => Promise<void> | void;

const hooks: { name: string; run: Hook }[] = [];
let shuttingDown = false;

/** Registers cleanup that runs on SIGTERM/SIGINT or `shutdown()`, last registered first. */
export function onShutdown(name: string, run: Hook): void {
	hooks.push({ name, run });
}

export async function shutdown(code = 0): Promise<never> {
	if (!shuttingDown) {
		shuttingDown = true;
		for (const hook of [...hooks].reverse()) {
			try {
				await hook.run();
			} catch (error) {
				logger.error({ err: error, hook: hook.name }, "shutdown hook failed");
			}
		}
	}
	process.exit(code);
}

export function handleSignals(): void {
	for (const signal of ["SIGTERM", "SIGINT"] as const) {
		process.once(signal, () => {
			logger.info({ signal }, "shutting down");
			void shutdown(0);
		});
	}
}
