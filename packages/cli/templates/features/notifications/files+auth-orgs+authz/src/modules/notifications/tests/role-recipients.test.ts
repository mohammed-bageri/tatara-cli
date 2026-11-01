import type { InlineDriver } from "@tatara/jobs";
import { beforeEach, describe, expect, it } from "vitest";
import { jobs } from "#core/jobs/index";
import { notify } from "#modules/notifications/services/notifier";
import { api } from "#tests/helpers/api";
import { authenticate } from "#tests/helpers/auth";
import { applyTestAccess } from "#tests/helpers/authz";
import { resetDatabase } from "#tests/helpers/db";

const drain = () => (jobs.driver as InlineDriver).drain();

beforeEach(async () => {
	await resetDatabase();
});

describe("notifying by role", () => {
	it("reaches the members who hold the authz role, not better-auth's member role", async () => {
		const admin = await authenticate();
		await applyTestAccess(admin.userId, { systemRoles: ["admin"], orgId: admin.orgId });
		const plain = await authenticate();
		await notify({
			orgId: admin.orgId as string,
			to: { role: "admin" },
			notification: "example.welcome",
			data: { name: "Ada" },
		});
		await drain();
		const count = async (headers: Record<string, string>) =>
			(await api.get<{ data: { count: number } }>("/api/notifications/unread-count", { headers }))
				.body.data.count;
		expect(await count(admin.headers)).toBe(1);
		expect(await count(plain.headers)).toBe(0);
	});
});
