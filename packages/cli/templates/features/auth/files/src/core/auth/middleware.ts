import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import type { AppEnv, Principal } from "#core/http/context";
import { ForbiddenError, UnauthorizedError } from "#core/http/errors";

/** 401 unless the request carries a valid session or token. */
export function requireAuth() {
	return createMiddleware<AppEnv>(async (c, next) => {
		if (!c.get("principal")) throw new UnauthorizedError();
		await next();
	});
}

/** 401 without a principal, 403 unless it has at least one of the roles. */
export function requireRole(...roles: string[]) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const principal = c.get("principal");
		if (!principal) throw new UnauthorizedError();
		if (!principal.roles.some((role) => roles.includes(role))) throw new ForbiddenError();
		await next();
	});
}

/** The authenticated principal; use in handlers behind requireAuth(). */
export function currentPrincipal(c: Context<AppEnv>): Principal {
	const principal = c.get("principal");
	if (!principal) throw new UnauthorizedError();
	return principal;
}
