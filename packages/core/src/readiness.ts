type Check = () => Promise<void>;

export function createReadiness() {
	const checks = new Map<string, Check>();
	return {
		/** Registers a dependency checked by GET /ready (database, redis, …). */
		registerReadinessCheck(name: string, check: Check): void {
			checks.set(name, check);
		},
		async runReadinessChecks() {
			const results = await Promise.all(
				[...checks].map(async ([name, check]) => {
					try {
						await check();
						return [name, "ok"] as const;
					} catch {
						return [name, "failed"] as const;
					}
				}),
			);
			return {
				ready: results.every(([, status]) => status === "ok"),
				checks: Object.fromEntries(results),
			};
		},
	};
}
