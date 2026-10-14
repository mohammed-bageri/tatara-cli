import { createMiddleware } from "hono/factory";
import { auth } from "#core/auth/auth";
import type { AppEnv } from "#core/http/context";

/** Resolves the session (cookie or bearer token) into `c.var.principal`. */
export const attachPrincipal = createMiddleware<AppEnv>(async (c, next) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (session) {
		const user = session.user as typeof session.user & { role?: string | null };
		const s = session.session as typeof session.session & { activeOrganizationId?: string | null };
		c.set("principal", {
			userId: user.id,
			orgId: s.activeOrganizationId ?? null,
			roles: (user.role ?? "user")
				.split(",")
				.map((role) => role.trim())
				.filter(Boolean),
			kind: "user",
			claims: {},
		});
	}
	await next();
});
