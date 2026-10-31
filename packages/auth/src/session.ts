import type { Principal } from "./principal.ts";

type Where = { field: string; value: string }[];

/** The parts of a better-auth instance tatara reads; any `betterAuth({...})` satisfies it. */
export interface SessionAuth {
	api: {
		getSession(input: { headers: Headers }): Promise<{
			user: { id: string };
			session: object;
		} | null>;
	};
	$context: Promise<{
		adapter: { findOne<T>(input: { model: string; where: Where }): Promise<T | null> };
	}>;
}

/**
 * The session's active organization, or null once the user stops being a member of it.
 * better-auth leaves `activeOrganizationId` on the removed member's session.
 */
async function activeMembership(auth: SessionAuth, userId: string, orgId: unknown) {
	if (typeof orgId !== "string" || !orgId) return null;
	const { adapter } = await auth.$context;
	const member = await adapter.findOne({
		model: "member",
		where: [
			{ field: "organizationId", value: orgId },
			{ field: "userId", value: userId },
		],
	});
	return member ? { orgId, role: (member as { role?: string }).role ?? null } : null;
}

/** The better-auth session (cookie or bearer token) as a principal. Roles come from the admin plugin's `role`. */
export async function sessionPrincipal(
	auth: SessionAuth,
	headers: Headers,
): Promise<Principal | null> {
	const session = await auth.api.getSession({ headers });
	if (!session) return null;
	const user = session.user as { id: string; role?: string | null };
	const { activeOrganizationId } = session.session as { activeOrganizationId?: string | null };
	const membership = await activeMembership(auth, user.id, activeOrganizationId);
	return {
		userId: user.id,
		orgId: membership?.orgId ?? null,
		orgRole: membership?.role ?? null,
		roles: (user.role ?? "user")
			.split(",")
			.map((role) => role.trim())
			.filter(Boolean),
		kind: "user",
		claims: {},
	};
}
