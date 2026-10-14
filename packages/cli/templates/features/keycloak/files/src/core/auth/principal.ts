import { createMiddleware } from "hono/factory";
import { organizationOf, rolesOf, verifyAccessToken } from "#core/auth/keycloak";
import { ensureLocalUser } from "#core/auth/users";
import type { AppEnv } from "#core/http/context";

/** Verifies `Authorization: Bearer <Keycloak access token>` into `c.var.principal`. */
export const attachPrincipal = createMiddleware<AppEnv>(async (c, next) => {
	const header = c.req.header("authorization");
	const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
	if (token) {
		try {
			const claims = await verifyAccessToken(token);
			const isService = claims.preferred_username?.startsWith("service-account-") ?? false;
			if (!isService) await ensureLocalUser(claims);
			c.set("principal", {
				userId: claims.sub,
				orgId: organizationOf(claims),
				roles: rolesOf(claims),
				kind: isService ? "service" : "user",
				claims,
			});
		} catch (error) {
			c.get("logger").debug({ err: error }, "rejected bearer token");
		}
	}
	await next();
});
