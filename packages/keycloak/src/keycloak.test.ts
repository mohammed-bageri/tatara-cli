import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { bearer, organization } from "better-auth/plugins";
import { generateKeyPair, SignJWT } from "jose";
import { pino } from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import {
	keycloakPrincipal,
	keycloakTokens,
	keycloakVerifier,
	organizationOf,
	organizationsOf,
	rolesOf,
} from "./index.ts";
import { useTestKeys } from "./testing.ts";

const logger = pino({ level: "silent" });
const verifier = keycloakVerifier({
	url: "http://keycloak.test/",
	realm: "app",
	audience: "app-api",
});
const keycloakToken = await useTestKeys(verifier);

type Db = Record<string, Record<string, unknown>[]>;
const empty = (): Db => ({
	user: [],
	session: [],
	account: [],
	verification: [],
	organization: [],
	member: [],
	invitation: [],
});
let db = empty();

function makeAuth(organizations: boolean) {
	return betterAuth({
		secret: "test-secret-that-is-at-least-32-characters",
		baseURL: "http://localhost",
		database: memoryAdapter(db),
		plugins: [bearer(), organization(), keycloakTokens({ verifier, logger, organizations })],
	});
}

const principalOf = async (token: string, organizations = false) =>
	keycloakPrincipal(makeAuth(organizations), `Bearer ${token}`);

beforeEach(() => {
	db = empty();
});

describe("keycloakVerifier", () => {
	it("derives the realm issuer", () => {
		expect(verifier.issuer).toBe("http://keycloak.test/realms/app");
	});
});

describe("keycloakTokens + keycloakPrincipal", () => {
	it("turns a valid token into the token subject's principal", async () => {
		const sub = crypto.randomUUID();
		const principal = await principalOf(await keycloakToken({ sub, roles: ["teacher"] }));
		expect(principal).toMatchObject({ userId: sub, kind: "user", orgId: null });
		// no organization claim: better-auth membership decides the orgs
		expect(principal?.orgs).toBeUndefined();
		expect(principal?.roles).toContain("teacher");
	});

	it("creates the local user and links a keycloak account on first use", async () => {
		const sub = crypto.randomUUID();
		await principalOf(await keycloakToken({ sub, email: "KC@example.com" }));
		expect(db.user?.find((u) => u.id === sub)).toMatchObject({ email: "kc@example.com" });
		expect(db.account?.find((a) => a.userId === sub)).toMatchObject({
			providerId: "keycloak",
			accountId: sub,
		});
	});

	it.each([
		["an expired token", { expiresIn: Math.floor(Date.now() / 1000) - 60 }],
		["a token from another issuer", { issuer: "https://evil.example.com/realms/app" }],
		["a token for another audience", { audience: "someone-else" }],
	])("rejects %s", async (_label, options) => {
		expect(await principalOf(await keycloakToken(options))).toBeNull();
	});

	it("rejects a token signed with an unknown key", async () => {
		const { privateKey } = await generateKeyPair("RS256");
		const forged = await new SignJWT({ roles: ["admin"] })
			.setProtectedHeader({ alg: "RS256", kid: "test" })
			.setSubject(crypto.randomUUID())
			.setIssuer(verifier.issuer)
			.setAudience(verifier.audience)
			.setExpirationTime("5m")
			.sign(privateKey);
		expect(await principalOf(forged)).toBeNull();
	});

	it("ignores headers that are not bearer tokens", async () => {
		const auth = makeAuth(false);
		expect(await keycloakPrincipal(auth, undefined)).toBeNull();
		expect(await keycloakPrincipal(auth, "Basic abc")).toBeNull();
		expect(await keycloakPrincipal(auth, "Bearer not-a-token")).toBeNull();
	});

	it("treats service-account tokens as services without a user row", async () => {
		const sub = crypto.randomUUID();
		const principal = await principalOf(
			await keycloakToken({ sub, username: "service-account-billing" }),
		);
		expect(principal).toMatchObject({ userId: sub, kind: "service" });
		expect(db.user).toHaveLength(0);
	});

	it("rejects a token whose email belongs to another account", async () => {
		db.user?.push({ id: "other", email: "taken@example.com", name: "x", emailVerified: true });
		const sub = crypto.randomUUID();
		expect(await principalOf(await keycloakToken({ sub, email: "taken@example.com" }))).toBeNull();
		expect(db.user?.find((u) => u.id === sub)).toBeUndefined();
	});

	it("does not store an email Keycloak has not verified", async () => {
		const sub = crypto.randomUUID();
		await principalOf(
			await keycloakToken({ sub, email: "victim@example.com", emailVerified: false }),
		);
		const user = db.user?.find((u) => u.id === sub);
		expect(user?.email).not.toBe("victim@example.com");
		expect(user?.emailVerified).toBe(false);
	});

	it("records the token's organization and membership when asked", async () => {
		const sub = crypto.randomUUID();
		const principal = await principalOf(
			await keycloakToken({ sub, organization: ["school-1"] }),
			true,
		);
		expect(principal?.orgId).toBe("school-1");
		expect(principal?.orgs).toEqual(["school-1"]);
		expect(db.organization?.map((o) => o.id)).toEqual(["school-1"]);
		expect(db.member?.find((m) => m.userId === sub)).toMatchObject({ organizationId: "school-1" });
	});
});

describe("claims", () => {
	it("collects realm, top-level and audience client roles", () => {
		const claims = {
			sub: "s",
			roles: ["a"],
			realm_access: { roles: ["b", "a"] },
			resource_access: { "app-api": { roles: ["c"] }, other: { roles: ["d"] } },
		};
		expect(rolesOf(claims, "app-api").sort()).toEqual(["a", "b", "c"]);
	});

	it.each([
		[["org-a", "org-b"], "org-a"],
		[{ alias: { id: "org-id" } }, "org-id"],
		[{ alias: {} }, "alias"],
		[{}, null],
		[undefined, null],
	])("reads the organization from %j", (organization, expected) => {
		expect(organizationOf({ sub: "s", organization })).toBe(expected);
	});

	it.each([
		[
			["org-a", "org-b"],
			["org-a", "org-b"],
		],
		[{ a: { id: "org-id" }, b: {} }, ["org-id", "b"]],
		[undefined, []],
	])("reads every organization from %j", (organization, expected) => {
		expect(organizationsOf({ sub: "s", organization })).toEqual(expected);
	});
});
