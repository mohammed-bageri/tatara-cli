import { beforeEach, describe, expect, it } from "vitest";
import { allows, type EffectivePermissions } from "@tatara/authz";
import { api } from "#tests/helpers/api";
import { asUser, authenticate } from "#tests/helpers/auth";
import { applyTestAccess } from "#tests/helpers/authz";
import { resetDatabase } from "#tests/helpers/db";

const set = (grants: EffectivePermissions["grants"], denies: string[] = []): EffectivePermissions => ({
	grants,
	denies: new Set(denies),
	roles: [],
});

describe("resolver", () => {
	it("lets a deny overlay win over any grant", () => {
		const p = set([{ resource: "role", action: "read", scope: null }], ["role:read:*"]);
		expect(allows(p, "role", "read")).toBe(false);
	});

	it("does not let a denied wide grant satisfy a narrower check", () => {
		const p = set([{ resource: "doc", action: "read", scope: "org" }], ["doc:read:org"]);
		expect(allows(p, "doc", "read", "team")).toBe(false);
		expect(allows(p, "doc", "read")).toBe(false);
	});

	it("honours the scope hierarchy org > team > own", () => {
		const p = set([{ resource: "doc", action: "read", scope: "team" }]);
		expect(allows(p, "doc", "read", "own")).toBe(true);
		expect(allows(p, "doc", "read", "team")).toBe(true);
		expect(allows(p, "doc", "read", "org")).toBe(false);
	});
});

describe("/api/authorization", () => {
	beforeEach(async () => {
		await resetDatabase();
	});

	it("forbids listing roles without role:read", async () => {
		const res = await api.get("/api/authorization/roles", { headers: await asUser() });
		expect(res.status).toBe(403);
	});

	it("lets an admin list built-in roles", async () => {
		const res = await api.get<{ data: { key: string; isSystem: boolean }[] }>(
			"/api/authorization/roles",
			{ headers: await asUser({ systemRoles: ["admin"] }) },
		);
		expect(res.status).toBe(200);
		const builtIn = res.body.data.filter((r) => r.isSystem).map((r) => r.key);
		expect(builtIn).toEqual(expect.arrayContaining(["admin", "member"]));
	});

	it("rejects custom roles that grant authorization itself", async () => {
		const res = await api.post(
			"/api/authorization/roles",
			{ key: "sneaky", name: "Sneaky", grants: [{ resource: "role", action: "update" }] },
			{ headers: await asUser({ systemRoles: ["admin"] }) },
		);
		expect(res.status).toBe(400);
		expect(res.body).toMatchObject({ code: "META_GRANT_FORBIDDEN" });
	});

	it("creates, assigns and audits a custom role", async () => {
		const headers = await asUser({ systemRoles: ["admin"] });
		const created = await api.post<{ data: { id: string } }>(
			"/api/authorization/roles",
			{ key: "auditor", name: "Auditor", grants: [] },
			{ headers },
		);
		expect(created.status).toBe(201);
		const member = await authenticate();
		const assigned = await api.post(
			`/api/authorization/members/${member.userId}/roles`,
			{ roleId: created.body.data.id },
			{ headers },
		);
		expect(assigned.status).toBe(200);
		const read = await api.get<{ data: { roles: { key: string }[] } }>(
			`/api/authorization/members/${member.userId}`,
			{ headers },
		);
		expect(read.body.data.roles.map((r) => r.key)).toEqual(["auditor"]);
		const audit = await api.get<{ data: { changeType: string }[] }>("/api/authorization/audit", {
			headers,
		});
		expect(audit.body.data.map((a) => a.changeType)).toEqual(["member_role_assigned", "role_created"]);
	});

	it("denies a permission with an overlay even when a role grants it", async () => {
		const member = await authenticate();
		await applyTestAccess(member.userId, { systemRoles: ["admin"] });
		const admin = await asUser({ systemRoles: ["admin"] });
		const denied = await api.post(
			`/api/authorization/members/${member.userId}/overlays`,
			{ resource: "role", action: "read", effect: "deny" },
			{ headers: admin },
		);
		expect(denied.status).toBe(201);
		const res = await api.get("/api/authorization/roles", { headers: member.headers });
		expect(res.status).toBe(403);
	});

	it("only removes an overlay for the member in the URL", async () => {
		const admin = await asUser({ systemRoles: ["admin"] });
		const alice = await authenticate();
		const bob = await authenticate();
		const created = await api.post<{ data: { id: string } }>(
			`/api/authorization/members/${alice.userId}/overlays`,
			{ resource: "role", action: "read", effect: "deny" },
			{ headers: admin },
		);
		const wrong = await api.delete(
			`/api/authorization/members/${bob.userId}/overlays/${created.body.data.id}`,
			{ headers: admin },
		);
		expect(wrong.status).toBe(404);
		const member = await api.get<{ data: { overlays: { id: string }[] } }>(
			`/api/authorization/members/${alice.userId}`,
			{ headers: admin },
		);
		expect(member.body.data.overlays.map((o) => o.id)).toEqual([created.body.data.id]);
	});

	it("reports the caller's effective permissions", async () => {
		const res = await api.get<{ data: { roles: string[]; grants: { resource: string }[] } }>(
			"/api/authorization/me",
			{ headers: await asUser({ systemRoles: ["admin"] }) },
		);
		expect(res.status).toBe(200);
		// with organizations the member's org role ("member") counts too
		expect(res.body.data.roles).toContain("admin");
		expect(res.body.data.grants.map((g) => g.resource)).toContain("audit_log");
	});

	it("never lets an overlay grant authorization itself", async () => {
		const admin = await asUser({ systemRoles: ["admin"] });
		const member = await authenticate();
		const res = await api.post(
			`/api/authorization/members/${member.userId}/overlays`,
			{ resource: "role", action: "update", effect: "grant" },
			{ headers: admin },
		);
		expect(res.status).toBe(400);
		expect(res.body).toMatchObject({ code: "META_GRANT_FORBIDDEN" });
	});
});
