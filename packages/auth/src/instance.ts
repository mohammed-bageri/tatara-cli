import { AppError, ForbiddenError, UnauthorizedError } from "@tatara/http";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import type { Env, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { type AuthEnv, type PrincipalResolver, principalMiddleware } from "./principal.ts";
import { sessionPrincipal } from "./session.ts";

/** 400 ORG_REQUIRED: the route acts in an organization and the request didn't say which. */
export class OrgRequiredError extends AppError {
	constructor() {
		super(400, "ORG_REQUIRED", "Choose an organization (x-org-id header)", undefined, true);
	}
}

export interface AuthInstanceOptions<A> {
	/** other credentials besides the session, tried in order (e.g. Keycloak tokens) */
	resolvers?: ((auth: A) => PrincipalResolver)[];
	/**
	 * Every principal of this instance acts in this org, e.g. internal staff in "platform": their
	 * permissions live apart from any customer org's.
	 */
	org?: string;
}

/**
 * The app's better-auth instance plus the middleware every app needs. The options are the app's
 * own (adapter, plugins, hooks); tatara adds nothing to them. Mount `auth.handler` where the app
 * wants it.
 */
export function createAuthInstance<O extends BetterAuthOptions>(
	options: O,
	extra: AuthInstanceOptions<ReturnType<typeof betterAuth<O>>> = {},
) {
	const auth = betterAuth(options);

	const inOrg = (resolve: PrincipalResolver): PrincipalResolver =>
		extra.org
			? async (c) => {
					const principal = await resolve(c);
					return principal ? { ...principal, orgId: extra.org as string, orgRole: null } : null;
				}
			: resolve;

	/** Sets `c.var.principal` from the session, then from the extra resolvers. */
	const attachPrincipal = principalMiddleware<AuthEnv>(
		(
			[
				(c) => sessionPrincipal(auth as never, c.req.raw.headers),
				...(extra.resolvers ?? []).map((resolver) => resolver(auth)),
			] as PrincipalResolver[]
		).map(inOrg),
	) as unknown as MiddlewareHandler<Env>;

	/**
	 * The org the request acts in: the `x-org-id` header, else the session's active org. The
	 * caller must be a member; `principal.orgId` and `orgRole` are set from the member row.
	 */
	function requireOrg(opts: { header?: string } = {}): MiddlewareHandler<Env> {
		const header = opts.header ?? "x-org-id";
		return createMiddleware<AuthEnv>(async (c, next) => {
			const principal = c.get("principal");
			if (!principal) throw new UnauthorizedError();
			const orgId = c.req.header(header) ?? principal.orgId;
			if (!orgId) throw new OrgRequiredError();
			// a service token is issued for one org; a token's org claim beats member rows it left behind
			const vouched =
				principal.kind === "service" ? [principal.orgId] : (principal.orgs ?? undefined);
			if (vouched && !vouched.includes(orgId))
				throw new ForbiddenError("Not a member of this organization");
			if (principal.kind !== "service") {
				const { adapter } = await (
					auth as unknown as { $context: Promise<{ adapter: MemberLookup }> }
				).$context;
				const member = await adapter.findOne<{ role?: string }>({
					model: "member",
					where: [
						{ field: "organizationId", value: orgId },
						{ field: "userId", value: principal.userId },
					],
				});
				if (!member && !vouched) throw new ForbiddenError("Not a member of this organization");
				c.set("principal", { ...principal, orgId, orgRole: member?.role ?? null });
			}
			await next();
		}) as unknown as MiddlewareHandler<Env>;
	}

	return { auth, attachPrincipal, requireOrg };
}

interface MemberLookup {
	findOne<T>(input: {
		model: string;
		where: { field: string; value: string }[];
	}): Promise<T | null>;
}
