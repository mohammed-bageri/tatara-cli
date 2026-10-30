import { ForbiddenError, UnauthorizedError } from "@tatara/http";
import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";

export interface Principal {
	userId: string;
	orgId: string | null;
	roles: string[];
	kind: "user" | "service";
	claims: Record<string, unknown>;
}

/** The variables these middlewares read and set; an app's env extends it. */
export interface AuthEnv {
	Variables: { principal: Principal | null };
}

/** Turns a request into a principal, or null when its credentials are not this resolver's. */
export type PrincipalResolver<E extends AuthEnv = AuthEnv> = (
	c: Context<E>,
) => Promise<Principal | null> | Principal | null;

/** Sets `c.var.principal` from the first resolver that recognises the request. */
export function principalMiddleware<E extends AuthEnv = AuthEnv>(
	resolvers: PrincipalResolver<E>[],
): MiddlewareHandler<E> {
	return createMiddleware<E>(async (c, next) => {
		for (const resolve of resolvers) {
			const principal = await resolve(c);
			if (principal) {
				c.set("principal", principal);
				break;
			}
		}
		await next();
	});
}

interface PrincipalReader {
	get(key: "principal"): Principal | null;
}

/** 401 unless the request carries a valid session or token. */
export function requireAuth<E extends AuthEnv = AuthEnv>(): MiddlewareHandler<E> {
	return createMiddleware<E>(async (c, next) => {
		if (!c.get("principal")) throw new UnauthorizedError();
		await next();
	});
}

/** 401 without a principal, 403 unless it has at least one of the roles. */
export function requireRole<E extends AuthEnv = AuthEnv>(...roles: string[]): MiddlewareHandler<E> {
	return createMiddleware<E>(async (c, next) => {
		const principal = c.get("principal") as Principal | null;
		if (!principal) throw new UnauthorizedError();
		if (!principal.roles.some((role) => roles.includes(role))) throw new ForbiddenError();
		await next();
	});
}

/** The authenticated principal; use in handlers behind requireAuth(). */
export function currentPrincipal(c: PrincipalReader): Principal {
	const principal = c.get("principal");
	if (!principal) throw new UnauthorizedError();
	return principal;
}
