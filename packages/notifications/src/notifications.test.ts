import { createJobs, inlineDriver } from "@tatara/jobs";
import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	createNotifier,
	defineNotification,
	fcmPush,
	memoryNotificationStore,
	type NotificationsOf,
	twilioSms,
} from "./index.ts";

const logger = pino({ level: "silent" });

const invoicePaid = defineNotification({
	name: "billing.invoice-paid",
	description: "An invoice was paid",
	schema: z.object({ invoice: z.string(), amount: z.number() }),
	channels: ["in-app", "email", "sms", "push"],
	inApp: ({ invoice }, language) => ({
		title: language === "ar" ? `تم دفع ${invoice}` : `Invoice ${invoice} paid`,
		url: `/invoices/${invoice}`,
	}),
	email: ({ invoice, amount }) => ({ subject: `Invoice ${invoice} paid`, text: `Paid: ${amount}` }),
	sms: ({ invoice }) => `Invoice ${invoice} paid`,
	push: ({ invoice }) => ({ title: `Invoice ${invoice} paid` }),
});
const notifications = [invoicePaid] as const;

function setup(overrides: { failEmailTimes?: number } = {}) {
	const store = memoryNotificationStore();
	const emails: { to: string; subject: string }[] = [];
	const texts: string[] = [];
	const pushes: string[][] = [];
	let failEmail = overrides.failEmailTimes ?? 0;
	// biome-ignore lint/suspicious/noExplicitAny: the consumers are wired in below
	let consumers: any[] = [];
	const driver = inlineDriver({ consumers: async () => consumers, logger, retryDelay: () => 0 });
	const jobs = createJobs({ driver });
	const notifier = createNotifier<NotificationsOf<typeof notifications>>({
		notifications,
		store,
		enqueue: jobs.enqueue as never,
		recipients: {
			async role(_org, role) {
				return role === "admin" ? ["u1", "u2"] : [];
			},
			async *permission(_org, permission) {
				if (permission === "invoice:read") yield* ["u2", "u3"];
			},
		},
		async contact(userId) {
			return {
				email: `${userId}@x`,
				phone: userId === "u3" ? null : "+100",
				language: userId === "u2" ? "ar" : "en",
			};
		},
		email: {
			async send(message) {
				if (failEmail-- > 0) throw new Error("smtp down");
				emails.push({ to: message.to, subject: message.subject });
			},
		},
		sms: { send: async (_to, text) => void texts.push(text) },
		push: {
			async send(tokens) {
				pushes.push([...tokens]);
				return { invalidTokens: tokens.filter((t) => t.startsWith("dead")) };
			},
		},
		logger,
	});
	consumers = [...notifier.consumers];
	return { store, emails, texts, pushes, driver, notifier };
}

const data = { invoice: "INV-1", amount: 10 };

describe("notify", () => {
	it("stores an inbox entry and sends each channel to each recipient, in their language", async () => {
		const t = setup();
		await t.store.addPushToken("u1", "tok-1", "ios");
		await t.notifier.notify({
			orgId: "o1",
			to: { role: "admin" },
			notification: "billing.invoice-paid",
			data,
		});
		await t.driver.drain();
		expect(t.driver.dead).toEqual([]);
		expect(t.store.rows.map((r) => [r.userId, r.title])).toEqual([
			["u1", "Invoice INV-1 paid"],
			["u2", "تم دفع INV-1"],
		]);
		expect(t.emails.map((e) => e.to).sort()).toEqual(["u1@x", "u2@x"]);
		expect(t.texts).toHaveLength(2);
		expect(t.pushes).toEqual([["tok-1"]]);
	});

	it("fans out by permission and dedupes users", async () => {
		const t = setup();
		await t.notifier.notify({
			orgId: "o1",
			to: { permission: "invoice:read" },
			notification: "billing.invoice-paid",
			data,
			channels: ["in-app"],
		});
		await t.notifier.notify({
			orgId: "o1",
			to: { users: ["u4", "u4"] },
			notification: "billing.invoice-paid",
			data,
			channels: ["in-app"],
		});
		await t.driver.drain();
		expect(t.store.rows.map((r) => r.userId).sort()).toEqual(["u2", "u3", "u4"]);
		expect(t.emails).toEqual([]);
	});

	it("notifies once per recipient for the same idempotency key", async () => {
		const t = setup();
		for (let i = 0; i < 2; i++)
			await t.notifier.notify({
				orgId: "o1",
				to: { user: "u1" },
				notification: "billing.invoice-paid",
				data,
				idempotencyKey: "inv-1-paid",
			});
		await t.driver.drain();
		expect(t.store.rows).toHaveLength(1);
		expect(t.emails).toHaveLength(1);
	});

	it("retries only the channel that failed", async () => {
		const t = setup({ failEmailTimes: 1 });
		await t.notifier.notify({
			orgId: "o1",
			to: { user: "u1" },
			notification: "billing.invoice-paid",
			data,
		});
		await t.driver.drain();
		expect(t.emails).toHaveLength(1);
		expect(t.texts).toHaveLength(1);
		expect(t.store.rows).toHaveLength(1);
	});

	it("skips channels a user can't receive, and forgets dead push tokens", async () => {
		const t = setup();
		await t.store.addPushToken("u3", "dead-1", null);
		await t.notifier.notify({
			orgId: "o1",
			to: { user: "u3" },
			notification: "billing.invoice-paid",
			data,
		});
		await t.driver.drain();
		expect(t.texts).toEqual([]);
		expect(await t.store.pushTokens("u3")).toEqual([]);
		expect(t.store.rows[0]?.sent.sort()).toEqual(["email", "in-app", "push", "sms"]);
	});

	it("refuses data the notification's schema rejects, before queueing", async () => {
		const t = setup();
		await expect(
			t.notifier.notify({
				orgId: "o1",
				to: { user: "u1" },
				notification: "billing.invoice-paid",
				data: { invoice: 1 } as never,
			}),
		).rejects.toThrow(/Invalid data for notification billing.invoice-paid/);
	});

	it("needs a renderer for each channel it lists", () => {
		expect(() =>
			defineNotification({ name: "x", description: "", schema: z.object({}), channels: ["email"] }),
		).toThrow(/lists email but has no email\(\)/);
	});
});

describe("the consumers", () => {
	it("keep their literal topics, so an app's typed enqueue stays typed", () => {
		const { notifier } = setup();
		const topics: readonly ("notifications.fanout" | "notifications.deliver")[] =
			notifier.consumers.map((c) => c.topic);
		// @ts-expect-error: a literal topic is not any string
		const wide: "notifications.fanout" = notifier.consumers[1].topic;
		expect(topics).toEqual(["notifications.fanout", "notifications.deliver"]);
		expect(wide).toBe("notifications.deliver");
	});
});

describe("the inbox", () => {
	it("pages newest first and marks a user's own notifications read", async () => {
		const t = setup();
		await t.notifier.notify({
			orgId: "o1",
			to: { users: ["u1", "u2"] },
			notification: "billing.invoice-paid",
			data,
			channels: ["in-app"],
		});
		await t.driver.drain();
		const [mine] = await t.store.list("o1", "u1", { limit: 10 });
		const [theirs] = await t.store.list("o1", "u2", { limit: 10 });
		expect(await t.store.markRead("o1", "u1", [mine?.id as string, theirs?.id as string])).toBe(1);
		expect(await t.store.unreadCount("o1", "u1")).toBe(0);
		expect(await t.store.unreadCount("o1", "u2")).toBe(1);
	});
});

describe("senders", () => {
	it("sends SMS through Twilio's API", async () => {
		const fetch = vi.fn(async () => new Response("{}", { status: 201 }));
		await twilioSms({
			accountSid: "AC1",
			authToken: "t",
			from: "+1555",
			fetch: fetch as never,
		}).send("+1666", "hi");
		const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
		expect(String(init.body)).toContain("To=%2B1666");
	});

	it("pushes through FCM with a signed service-account token, reporting unregistered devices", async () => {
		const { generateKeyPairSync } = await import("node:crypto");
		const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
		const calls: string[] = [];
		const fetch = vi.fn(async (url: string, init: RequestInit) => {
			calls.push(url);
			if (url.includes("oauth2")) {
				expect(String(init.body)).toContain("grant_type=urn");
				return Response.json({ access_token: "at", expires_in: 3600 });
			}
			const token = JSON.parse(String(init.body)).message.token;
			return token === "gone"
				? new Response(
						'{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}',
						{ status: 404 },
					)
				: Response.json({ name: "ok" });
		});
		const push = fcmPush({
			projectId: "p1",
			clientEmail: "svc@p1.iam.gserviceaccount.com",
			privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
			fetch: fetch as never,
		});
		expect(await push.send(["ok-1", "gone"], { title: "Hi" })).toEqual({ invalidTokens: ["gone"] });
		await push.send(["ok-1"], { title: "Again" });
		// the access token is reused while it's valid
		expect(calls.filter((u) => u.includes("oauth2"))).toHaveLength(1);
	});
});
