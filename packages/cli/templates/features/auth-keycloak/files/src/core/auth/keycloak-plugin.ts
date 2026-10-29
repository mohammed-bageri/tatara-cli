import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { z } from "zod";
import {
	type KeycloakClaims,
	organizationOf,
	rolesOf,
	verifyAccessToken,
} from "#core/auth/keycloak";
import { logger } from "#core/logging/logger";

export interface KeycloakPrincipal {
	userId: string;
	orgId: string | null;
	roles: string[];
	kind: "user" | "service";
	claims: KeycloakClaims;
}

export interface KeycloakTokensOptions {
	/** Record the token's organization as a better-auth organization + membership. */
	organizations?: boolean;
}

type Adapter = Parameters<NonNullable<BetterAuthPlugin["init"]>>[0]["adapter"];

const ACCOUNT_PROVIDER = "keycloak";

async function ensureUser(adapter: Adapter, claims: KeycloakClaims): Promise<boolean> {
	// an unverified email could claim someone else's address, so it is never stored
	const verified = claims.email_verified === true && Boolean(claims.email);
	const email = verified
		? (claims.email as string).toLowerCase()
		: `${claims.sub}@users.keycloak.invalid`;
	const name = claims.name ?? claims.preferred_username ?? claims.sub;
	const owner = await adapter.findOne<{ id: string }>({
		model: "user",
		where: [{ field: "email", value: email }],
	});
	const existing = await adapter.findOne<{ id: string }>({
		model: "user",
		where: [{ field: "id", value: claims.sub }],
	});
	if (existing) {
		const emailFree = !owner || owner.id === claims.sub;
		if (!emailFree) logger.warn({ sub: claims.sub }, "keycloak email belongs to another account");
		await adapter.update({
			model: "user",
			where: [{ field: "id", value: claims.sub }],
			update: {
				name,
				...(emailFree ? { email, emailVerified: verified } : {}),
				updatedAt: new Date(),
			},
		});
		return true;
	}
	if (owner) {
		// never attach a Keycloak identity to an account that signs in another way
		logger.warn({ sub: claims.sub }, "keycloak token email belongs to another account");
		return false;
	}
	const now = new Date();
	await adapter.create({
		model: "user",
		data: { id: claims.sub, email, emailVerified: verified, name, createdAt: now, updatedAt: now },
		forceAllowId: true,
	});
	await adapter.create({
		model: "account",
		data: {
			userId: claims.sub,
			accountId: claims.sub,
			providerId: ACCOUNT_PROVIDER,
			createdAt: now,
			updatedAt: now,
		},
	});
	return true;
}

async function ensureMembership(adapter: Adapter, orgId: string, userId: string): Promise<void> {
	const org = await adapter.findOne({
		model: "organization",
		where: [{ field: "id", value: orgId }],
	});
	if (!org) {
		await adapter.create({
			model: "organization",
			data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
			forceAllowId: true,
		});
	}
	const member = await adapter.findOne({
		model: "member",
		where: [
			{ field: "organizationId", value: orgId },
			{ field: "userId", value: userId },
		],
	});
	if (!member) {
		await adapter.create({
			model: "member",
			data: { organizationId: orgId, userId, role: "member", createdAt: new Date() },
		});
	}
}

/**
 * Lets the API accept access tokens issued by Keycloak (a resource server).
 * Verified tokens become principals; their users and organizations are kept in better-auth's tables.
 */
export function keycloakTokens(options: KeycloakTokensOptions = {}) {
	// subjects already synced by this process; tokens are re-verified on every request regardless
	const synced = new Set<string>();
	return {
		id: "keycloak-tokens",
		endpoints: {
			// no path: callable only on the server as auth.api.verifyKeycloakToken
			verifyKeycloakToken: createAuthEndpoint(
				{ method: "POST", body: z.object({ token: z.string() }) },
				async (ctx): Promise<KeycloakPrincipal | null> => {
					let claims: KeycloakClaims;
					try {
						claims = await verifyAccessToken(ctx.body.token);
					} catch (error) {
						logger.debug({ err: error }, "rejected keycloak token");
						return null;
					}
					const isService = claims.preferred_username?.startsWith("service-account-") ?? false;
					const orgId = organizationOf(claims);
					if (!isService) {
						const key = `${claims.sub}|${orgId ?? ""}|${claims.email ?? ""}`;
						if (!synced.has(key)) {
							const { adapter } = ctx.context;
							if (!(await ensureUser(adapter, claims))) return null;
							if (orgId && options.organizations)
								await ensureMembership(adapter, orgId, claims.sub);
							if (synced.size > 10_000) synced.clear();
							synced.add(key);
						}
					}
					return {
						userId: claims.sub,
						orgId,
						roles: rolesOf(claims),
						kind: isService ? "service" : "user",
						claims,
					};
				},
			),
		},
	} satisfies BetterAuthPlugin;
}
