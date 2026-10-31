import type { InlineDriver } from "@tatara/jobs";
import { beforeEach, describe, expect, it } from "vitest";
import { jobs } from "#core/jobs/index";
import { notify } from "#modules/notifications/services/notifier";
import { api } from "#tests/helpers/api";
import { authenticate } from "#tests/helpers/auth";
import { resetDatabase } from "#tests/helpers/db";

const drain = () => (jobs.driver as InlineDriver).drain();

beforeEach(async () => {
	await resetDatabase();
});

describe("notifications", () => {
	it("puts a notification in the user's inbox, once per idempotency key", async () => {
		const user = await authenticate();
		const orgId = user.orgId ?? "default";
		for (let i = 0; i < 2; i++)
			await notify({
				orgId,
				to: { user: user.userId },
				notification: "example.welcome",
				data: { name: "Ada" },
				idempotencyKey: "welcome",
			});
		await drain();
		const list = await api.get<{ data: { id: string; title: string }[]; meta: { nextCursor: string | null } }>(
			"/api/notifications",
			{ headers: user.headers },
		);
		expect(list.status).toBe(200);
		expect(list.body.data.map((n) => n.title)).toEqual(["Welcome, Ada"]);
		expect(list.body.meta.nextCursor).toBeNull();
	});

	it("marks only the caller's notifications read", async () => {
		const [me, other] = [await authenticate(), await authenticate()];
		for (const user of [me, other])
			await notify({ orgId: user.orgId ?? "default", to: { user: user.userId }, notification: "example.welcome", data: { name: "x" } });
		await drain();
		const count = (h: Record<string, string>) =>
			api.get<{ data: { count: number } }>("/api/notifications/unread-count", { headers: h });
		expect((await count(me.headers)).body.data.count).toBe(1);
		const read = await api.post<{ data: { updated: number } }>("/api/notifications/read", { all: true }, { headers: me.headers });
		expect(read.body.data.updated).toBe(1);
		expect((await count(me.headers)).body.data.count).toBe(0);
		expect((await count(other.headers)).body.data.count).toBe(1);
	});

	it("needs a signed-in user", async () => {
		expect((await api.get("/api/notifications")).status).toBe(401);
	});
});
