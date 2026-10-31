import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "#modules/users/services/auth";
import { api } from "#tests/helpers/api";
import { authenticate } from "#tests/helpers/auth";
import { resetDatabase } from "#tests/helpers/db";

beforeEach(async () => {
	await resetDatabase();
});

describe("principal", () => {
	it("drops the active organization once the user is no longer a member", async () => {
		const owner = await authenticate();
		const member = await authenticate({ email: "member@example.com" });
		const org = await api.post<{ id: string }>(
			"/api/auth/organization/create",
			{ name: "School", slug: "school" },
			{ headers: owner.headers },
		);
		await auth.api.addMember({
			body: { userId: member.userId, role: "member", organizationId: org.body.id },
		});
		await api.post(
			"/api/auth/organization/set-active",
			{ organizationId: org.body.id },
			{ headers: member.headers },
		);
		const before = await api.get<{ data: { orgId: string | null } }>("/api/me", {
			headers: member.headers,
		});
		expect(before.body.data.orgId).toBe(org.body.id);

		const removed = await api.post(
			"/api/auth/organization/remove-member",
			{ memberIdOrEmail: "member@example.com", organizationId: org.body.id },
			{ headers: owner.headers },
		);
		expect(removed.status).toBe(200);
		const after = await api.get<{ data: { orgId: string | null } }>("/api/me", {
			headers: member.headers,
		});
		expect(after.body.data.orgId).toBeNull();
	});
});
