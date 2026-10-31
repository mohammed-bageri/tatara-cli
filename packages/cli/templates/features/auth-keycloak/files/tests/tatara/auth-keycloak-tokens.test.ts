import { generateKeyPair, SignJWT } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "#modules/users/services/auth";
import { keycloak } from "#modules/users/services/keycloak";
import { env } from "#core/config/env";
import { newId } from "@tatara/db";
import { api } from "#tests/helpers/api";
import { createTestUser, keycloakToken } from "#tests/helpers/auth";
import { resetDatabase } from "#tests/helpers/db";

interface Me {
	data: { userId: string; orgId: string | null; roles: string[]; kind: string };
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
const me = (token: string) => api.get<Me>("/api/me", { headers: bearer(token) });

// read through better-auth's adapter so the tests work with any ORM
async function find<T>(model: string, where: Record<string, string>): Promise<T | null> {
	const { adapter } = await auth.$context;
	return adapter.findOne<T>({
		model,
		where: Object.entries(where).map(([field, value]) => ({ field, value })),
	});
}
type UserRow = { email: string; emailVerified: boolean };

beforeEach(async () => {
	await resetDatabase();
});

describe("Keycloak access tokens", () => {
	it("authenticates a valid token as the token's subject", async () => {
		const sub = newId();
		const res = await me(await keycloakToken({ sub, roles: ["teacher"] }));
		expect(res.status).toBe(200);
		expect(res.body.data).toMatchObject({ userId: sub, kind: "user", orgId: null });
		expect(res.body.data.roles).toContain("teacher");
	});

	it("creates the local user and links a keycloak account on first use", async () => {
		const sub = newId();
		await me(await keycloakToken({ sub, email: "kc@example.com" }));
		const user = await find<UserRow>("user", { id: sub });
		expect(user?.email).toBe("kc@example.com");
		const account = await find<{ accountId: string }>("account", {
			userId: sub,
			providerId: "keycloak",
		});
		expect(account?.accountId).toBe(sub);
	});

	it.each([
		["an expired token", { expiresIn: Math.floor(Date.now() / 1000) - 60 }],
		["a token from another issuer", { issuer: "https://evil.example.com/realms/app" }],
		["a token for another audience", { audience: "someone-else" }],
	])("rejects %s", async (_label, options) => {
		expect((await me(await keycloakToken(options))).status).toBe(401);
	});

	it("rejects a token signed with an unknown key", async () => {
		const { privateKey } = await generateKeyPair("RS256");
		const forged = await new SignJWT({ roles: ["admin"] })
			.setProtectedHeader({ alg: "RS256", kid: "test" })
			.setSubject(newId())
			.setIssuer(keycloak.issuer)
			.setAudience(env.KEYCLOAK_AUDIENCE)
			.setExpirationTime("5m")
			.sign(privateKey);
		expect((await me(forged)).status).toBe(401);
	});

	it("rejects a bearer value that is not a token", async () => {
		expect((await me("not-a-token")).status).toBe(401);
	});

	it("treats service-account tokens as services without a user row", async () => {
		const sub = newId();
		const res = await me(await keycloakToken({ sub, username: "service-account-billing" }));
		expect(res.body.data).toMatchObject({ userId: sub, kind: "service" });
		expect(await find<UserRow>("user", { id: sub })).toBeNull();
	});


	it("rejects a token whose email belongs to another account", async () => {
		await createTestUser({ email: "taken@example.com" });
		const sub = newId();
		expect((await me(await keycloakToken({ sub, email: "taken@example.com" }))).status).toBe(401);
		expect(await find<UserRow>("user", { id: sub })).toBeNull();
	});


	it("does not store an email Keycloak has not verified", async () => {
		const sub = newId();
		await me(await keycloakToken({ sub, email: "victim@example.com", emailVerified: false }));
		const user = await find<UserRow>("user", { id: sub });
		expect(user?.email).not.toBe("victim@example.com");
		expect(user?.emailVerified).toBe(false);
	});

	it("keeps the old email when the token's new email belongs to another account", async () => {
		await createTestUser({ email: "taken@example.com" });
		const sub = newId();
		await me(await keycloakToken({ sub, email: "first@example.com" }));
		const res = await me(await keycloakToken({ sub, email: "taken@example.com" }));
		expect(res.status).toBe(200);
		expect((await find<UserRow>("user", { id: sub }))?.email).toBe("first@example.com");
	});
});
