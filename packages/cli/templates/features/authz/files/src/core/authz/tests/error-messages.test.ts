import { beforeEach, describe, expect, it } from "vitest";
import { api } from "#tests/helpers/api";
import { asUser, authenticate } from "#tests/helpers/auth";
import { resetDatabase } from "#tests/helpers/db";

beforeEach(async () => {
	await resetDatabase();
});

describe("error messages", () => {
	it("keeps a specific message instead of the generic one for its code", async () => {
		const headers = await asUser({ systemRoles: ["admin"] });
		const role = await api.post<{ data: { id: string } }>(
			"/api/authorization/roles",
			{ key: "auditor", name: "Auditor", grants: [] },
			{ headers },
		);
		const member = await authenticate();
		await api.post(
			`/api/authorization/members/${member.userId}/roles`,
			{ roleId: role.body.data.id },
			{ headers },
		);
		const res = await api.delete<{ code: string; error: string }>(
			`/api/authorization/roles/${role.body.data.id}`,
			{ headers },
		);
		expect(res.status).toBe(409);
		expect(res.body).toMatchObject({
			code: "CONFLICT",
			error: 'Role "auditor" is assigned to 1 member(s)',
		});
	});
});
