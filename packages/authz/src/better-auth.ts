/** The bridge between better-auth's organization plugin and authz, as a better-auth plugin. */
import type { BetterAuthPlugin } from "better-auth";
import {
	APIError,
	type AuthMiddleware,
	createAuthMiddleware,
	getSessionFromCtx,
} from "better-auth/api";
import type { Authz } from "./authz.ts";

export interface AuthzPluginOptions<K extends string> {
	/** built-in role an org's creator gets (default `"admin"`); `false` gives none */
	creatorRole?: string | false;
	/**
	 * Member roles better-auth may store (default owner and member): it tracks membership, authz
	 * decides access. Include better-auth's `creatorRole` if you changed it.
	 */
	memberRoles?: readonly string[];
	/** better-auth endpoints that also need an authz permission in every org the request names */
	endpoints?: Readonly<Record<string, K>>;
}

type HookCtx = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

// add-member is server-only (the app's own call) and has no path for hooks to match
const settingRole = new Set(["/organization/invite-member", "/organization/update-member-role"]);

const rolesIn = (value: unknown) =>
	(Array.isArray(value) ? value : [value])
		.flatMap((r) => (typeof r === "string" ? r.split(",") : []))
		.map((r) => r.trim())
		.filter(Boolean);

const record = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/**
 * The caller's session. Hooks see the raw request: `bearer()` turns a token into a session cookie
 * for the endpoint only, so a bearer token is looked up here.
 */
async function sessionOf(ctx: HookCtx) {
	const header = ctx.headers?.get("authorization");
	if (header?.toLowerCase().startsWith("bearer ")) {
		const token = header.slice(7).trim().split(".")[0];
		const found = token ? await ctx.context.internalAdapter.findSession(token) : null;
		if (found && new Date(found.session.expiresAt) > new Date()) return found;
	}
	return getSessionFromCtx(ctx);
}

/** Every org a request could mean: endpoints pick one differently, so all of them are checked. */
async function orgsNamed(ctx: HookCtx, activeOrgId: unknown): Promise<string[]> {
	const named = { ...record(ctx.body), ...record(ctx.query) };
	const ids = [named.organizationId, activeOrgId];
	if (typeof named.organizationSlug === "string") {
		const org = await ctx.context.adapter.findOne<{ id: string }>({
			model: "organization",
			where: [{ field: "slug", value: named.organizationSlug }],
		});
		ids.push(org?.id);
	}
	return [...new Set(ids.filter((id): id is string => typeof id === "string" && id !== ""))];
}

/**
 * Hands org access to authz: better-auth keeps who belongs to which org (members `owner` and
 * `member` only), and authz decides what they may do. The creator gets `creatorRole`, a member
 * removed or leaving loses their authz roles and overlays, and `endpoints` puts better-auth's own
 * org endpoints behind authz permissions. Add it after `organization()`.
 */
export function authzPlugin<K extends string>(
	authz: Pick<Authz<K>, "grantSystemRole" | "removeMemberAccess" | "checkPermission">,
	options: AuthzPluginOptions<K> = {},
) {
	const creatorRole = options.creatorRole ?? "admin";
	const memberRoles = new Set(options.memberRoles ?? ["owner", "member"]);
	const endpoints = options.endpoints ?? {};

	const lockRoles: AuthMiddleware = createAuthMiddleware(async (ctx) => {
		const refused = rolesIn(record(ctx.body).role).filter((role) => !memberRoles.has(role));
		if (refused.length)
			throw new APIError("BAD_REQUEST", {
				message: `Member roles are ${[...memberRoles].join(", ")}; give access with authz roles (${refused.join(", ")})`,
			});
	});

	const guard: AuthMiddleware = createAuthMiddleware(async (ctx) => {
		const permission = endpoints[ctx.path ?? ""];
		if (!permission) return;
		const session = await sessionOf(ctx);
		if (!session) return;
		const active = (session.session as { activeOrganizationId?: unknown }).activeOrganizationId;
		for (const orgId of await orgsNamed(ctx, active)) {
			const member = await ctx.context.adapter.findOne<{ role: string }>({
				model: "member",
				where: [
					{ field: "organizationId", value: orgId },
					{ field: "userId", value: session.user.id },
				],
			});
			// not a member: the endpoint itself refuses
			if (!member) continue;
			const roles = rolesIn((session.user as { role?: unknown }).role);
			const who = { userId: session.user.id, orgId, orgRole: member.role, roles };
			if (!(await authz.checkPermission(who, permission)))
				throw new APIError("FORBIDDEN", { message: "You do not have permission to do this" });
		}
	});

	const lifecycle: AuthMiddleware = createAuthMiddleware(async (ctx) => {
		const returned = ctx.context.returned;
		if (!returned || returned instanceof Error || returned instanceof Response) return;
		const body = record(returned);
		if (ctx.path === "/organization/create") {
			const creator = record((body.members as unknown[] | undefined)?.[0]);
			if (creatorRole && typeof body.id === "string" && typeof creator.userId === "string")
				// self-assigned, so the audit log shows who it was
				await authz.grantSystemRole(body.id, creator.userId, creatorRole, creator.userId);
			return;
		}
		const member = record(ctx.path === "/organization/remove-member" ? body.member : body);
		if (typeof member.organizationId === "string" && typeof member.userId === "string")
			await authz.removeMemberAccess(member.organizationId, member.userId);
	});

	return {
		id: "tatara-authz",
		hooks: {
			before: [
				{ matcher: (ctx) => settingRole.has(ctx.path ?? ""), handler: lockRoles },
				{ matcher: (ctx) => (ctx.path ?? "") in endpoints, handler: guard },
			],
			after: [
				{
					matcher: (ctx) =>
						ctx.path === "/organization/create" ||
						ctx.path === "/organization/remove-member" ||
						ctx.path === "/organization/leave",
					handler: lifecycle,
				},
			],
		},
	} satisfies BetterAuthPlugin;
}
