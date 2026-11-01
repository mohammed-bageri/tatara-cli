import type { Codemod } from "../codemods.ts";

const ENV_FILES = ["src/core/config/env.ts", ".env.example", ".env.test"];

/** Request timeouts and the caller's real address for better-auth, in apps made before 0.11. */
export const httpLimits: Codemod = {
	version: "0.11.0",
	id: "http-limits",
	description: "Request timeouts (REQUEST_TIMEOUT_MS) and trusted proxies (TRUSTED_PROXY_HOPS)",
	async run(ctx) {
		const customised: string[] = [];
		for (const path of ["src/apps/http.ts", ...ENV_FILES]) {
			const text = await ctx.read(path).catch(() => undefined);
			if (text === undefined) continue;
			if (await ctx.baseline.isUnchanged(path, text)) await ctx.regenerate(path);
			else customised.push(path);
		}
		if (customised.length > 0)
			ctx.report.notes.push(
				`Compare ${customised.join(", ")} with a newly generated app: env gains REQUEST_TIMEOUT_MS and TRUSTED_PROXY_HOPS; src/apps/http.ts passes timeouts: { defaultMs: env.REQUEST_TIMEOUT_MS } to createApp and hands better-auth the caller's address with withClientIp(c.req.raw, clientIp(c, { trustedHops: env.TRUSTED_PROXY_HOPS })), since better-auth otherwise rate-limits on an X-Forwarded-For the client can forge.`,
			);
	},
};
