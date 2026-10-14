import { createMiddleware } from "hono/factory";
import type { Scope } from "#core/authz/constants";
import { checkPermission } from "#core/authz/resolver";
import type { AppEnv } from "#core/http/context";
import { ForbiddenError, UnauthorizedError } from "#core/http/errors";
import type { PermissionKey } from "#generated/permissions";

/**
 * 401 without a principal, 403 unless it holds `resource:action` (at `scope` or wider).
 * Pair with `security: [{ bearerAuth: ["resource:action"] }]` so the route documents it.
 */
export function requirePermission(permission: PermissionKey, scope?: Scope) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const principal = c.get("principal");
		if (!principal) throw new UnauthorizedError();
		if (!(await checkPermission(principal, permission, scope))) {
			throw new ForbiddenError(`Missing permission ${permission}${scope ? ` (${scope})` : ""}`);
		}
		await next();
	});
}
