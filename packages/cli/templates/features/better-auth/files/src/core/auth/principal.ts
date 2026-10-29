import { createMiddleware } from "hono/factory";
import { auth } from "#core/auth/auth";
import type { AppEnv } from "#core/http/context";

/**
 * The session's active organization, or null once the user stops being a member of it.
 * better-auth leaves `activeOrganizationId` on the removed member's session.
 */
async function activeMembership(userId: string, orgId: string | null | undefined) {
	if (!orgId) return null;
	const { adapter } = await auth.$context;
	const member = await adapter.findOne({
		model: "member",
		where: [
			{ field: "organizationId", value: orgId },
			{ field: "userId", value: userId },
		],
	});
	return member ? orgId : null;
}

/** Resolves the session (cookie or bearer token) into `c.var.principal`. */
export const attachPrincipal = createMiddleware<AppEnv>(async (c, next) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (session) {
		const user = session.user as typeof session.user & { role?: string | null };
		const s = session.session as typeof session.session & { activeOrganizationId?: string | null };
		c.set("principal", {
			userId: user.id,
			orgId: await activeMembership(user.id, s.activeOrganizationId),
			roles: (user.role ?? "user")
				.split(",")
				.map((role) => role.trim())
				.filter(Boolean),
			kind: "user",
			claims: {},
		});
	}
	// tatara:slot no-session
	await next();
});
