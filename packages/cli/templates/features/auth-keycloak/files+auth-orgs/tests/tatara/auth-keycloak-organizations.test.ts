import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "#modules/users/services/auth";
import { newId } from "@tatara/db";
import { api } from "#tests/helpers/api";
import { keycloakToken } from "#tests/helpers/auth";
import { resetDatabase } from "#tests/helpers/db";

interface Me {
	data: { orgId: string | null };
}

const me = (token: string) =>
	api.get<Me>("/api/me", { headers: { authorization: `Bearer ${token}` } });

// read through better-auth's adapter so the tests work with any ORM
async function find<T>(model: string, where: Record<string, string>): Promise<T | null> {
	const { adapter } = await auth.$context;
	return adapter.findOne<T>({
		model,
		where: Object.entries(where).map(([field, value]) => ({ field, value })),
	});
}

beforeEach(async () => {
	await resetDatabase();
});

describe("Keycloak access tokens with organizations", () => {
	it("takes the organization from the token and records the membership", async () => {
		const sub = newId();
		const res = await me(await keycloakToken({ sub, organization: ["riyadh-school"] }));
		expect(res.body.data.orgId).toBe("riyadh-school");
		expect(await find("organization", { id: "riyadh-school" })).not.toBeNull();
		expect(await find("member", { organizationId: "riyadh-school", userId: sub })).not.toBeNull();
	});
});
