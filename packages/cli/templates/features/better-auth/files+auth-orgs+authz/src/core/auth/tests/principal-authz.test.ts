import { beforeEach, expect, it } from "vitest";
import { auth } from "#core/auth/auth";
import { api } from "#tests/helpers/api";
import { authenticate } from "#tests/helpers/auth";
import { applyTestAccess } from "#tests/helpers/authz";
import { resetDatabase } from "#tests/helpers/db";

beforeEach(async () => {
	await resetDatabase();
});

it("does not restore old org roles when a removed member is added back", async () => {
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
	await applyTestAccess(member.userId, { systemRoles: ["admin"], orgId: org.body.id });
	await api.post(
		"/api/auth/organization/remove-member",
		{ memberIdOrEmail: "member@example.com", organizationId: org.body.id },
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
	const roles = await api.get("/api/authorization/roles", { headers: member.headers });
	expect(roles.status).toBe(403);
});
