type Check = () => Promise<void>;

const checks = new Map<string, Check>();

/** Registers a dependency checked by GET /ready (database, redis, …). */
export function registerReadinessCheck(name: string, check: Check): void {
	checks.set(name, check);
}

export async function runReadinessChecks() {
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
}
