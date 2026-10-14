import {
	auth,
	authEmailOtp,
	authOrgs,
	authPassword,
	authPhoneOtp,
	betterAuth,
	keycloak,
} from "./auth.ts";
import { base, bun, npm, pnpm } from "./base.ts";
import { db, drizzle, mysql, postgres, prisma } from "./database.ts";
import type { Feature } from "./types.ts";

export const FEATURES: Record<string, Feature> = Object.fromEntries(
	[
		base,
		pnpm,
		npm,
		bun,
		db,
		postgres,
		mysql,
		drizzle,
		prisma,
		betterAuth,
		authEmailOtp,
		authPhoneOtp,
		authPassword,
		authOrgs,
		keycloak,
		auth,
	].map((f) => [f.id, f]),
);
