import { and, count, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import type { Channel } from "./define.ts";
import type { NotificationRow, NotificationStore } from "./store.ts";

/** The app's tables (src/modules/notifications/db/notifications.schema.ts), Postgres or MySQL. */
export interface DrizzleNotificationTables {
	// biome-ignore lint/suspicious/noExplicitAny: the same queries run on pg and mysql tables
	notifications: any;
	// biome-ignore lint/suspicious/noExplicitAny: as above
	pushTokens: any;
}

const channels = (sent: string): Channel[] => (sent ? (sent.split(",") as Channel[]) : []);

/** The NotificationStore for Drizzle, over the app's database and its notification tables. */
// biome-ignore lint/suspicious/noExplicitAny: a pg or mysql drizzle database
export function drizzleNotificationStore(
	db: any,
	tables: DrizzleNotificationTables,
): NotificationStore {
	const { notifications: n, pushTokens: p } = tables;
	const inbox = (orgId: string, userId: string) =>
		and(eq(n.orgId, orgId), eq(n.userId, userId), eq(n.inApp, true));
	return {
		async claim(row) {
			const find = async () =>
				(
					await db
						.select({ id: n.id, sent: n.sentChannels })
						.from(n)
						.where(eq(n.idempotencyKey, row.idempotencyKey))
				)[0];
			const found = await find();
			if (found) return { id: found.id, sent: channels(found.sent) };
			try {
				await db.insert(n).values({
					id: row.id,
					orgId: row.orgId,
					userId: row.userId,
					name: row.name,
					title: row.inApp?.title ?? "",
					body: row.inApp?.body ?? null,
					url: row.inApp?.url ?? null,
					inApp: row.inApp !== null,
					idempotencyKey: row.idempotencyKey,
					sentChannels: "",
				});
				return { id: row.id, sent: [] };
			} catch (error) {
				// a concurrent delivery of the same job inserted it first
				const raced = await find();
				if (raced) return { id: raced.id, sent: channels(raced.sent) };
				throw error;
			}
		},
		async markSent(id, channel) {
			const [row] = await db.select({ sent: n.sentChannels }).from(n).where(eq(n.id, id));
			const sent = channels(row?.sent ?? "");
			if (sent.includes(channel)) return;
			await db
				.update(n)
				.set({ sentChannels: [...sent, channel].join(",") })
				.where(eq(n.id, id));
		},
		async list(orgId, userId, { limit, before, unreadOnly }) {
			const rows = await db
				.select()
				.from(n)
				.where(
					and(
						inbox(orgId, userId),
						unreadOnly ? isNull(n.readAt) : undefined,
						before
							? or(
									lt(n.createdAt, before.createdAt),
									and(eq(n.createdAt, before.createdAt), lt(n.id, before.id)),
								)
							: undefined,
					),
				)
				.orderBy(desc(n.createdAt), desc(n.id))
				.limit(limit);
			return rows.map(
				(r: NotificationRow): NotificationRow => ({
					id: r.id,
					orgId: r.orgId,
					userId: r.userId,
					name: r.name,
					title: r.title,
					body: r.body,
					url: r.url,
					readAt: r.readAt,
					createdAt: r.createdAt,
				}),
			);
		},
		async unreadCount(orgId, userId) {
			const [row] = await db
				.select({ total: count() })
				.from(n)
				.where(and(inbox(orgId, userId), isNull(n.readAt)));
			return Number(row?.total ?? 0);
		},
		async markRead(orgId, userId, ids) {
			if (ids !== "all" && ids.length === 0) return 0;
			const where = and(
				inbox(orgId, userId),
				isNull(n.readAt),
				ids === "all" ? undefined : inArray(n.id, [...ids]),
			);
			const [row] = await db.select({ total: count() }).from(n).where(where);
			await db.update(n).set({ readAt: new Date() }).where(where);
			return Number(row?.total ?? 0);
		},
		async pushTokens(userId) {
			return (await db.select({ token: p.token }).from(p).where(eq(p.userId, userId))).map(
				(r: { token: string }) => r.token,
			);
		},
		async addPushToken(userId, token, device) {
			// a token moves to whoever signed in on the device last
			await db.delete(p).where(eq(p.token, token));
			await db.insert(p).values({ token, userId, device, lastSeenAt: new Date() });
		},
		async removePushTokens(tokens) {
			if (tokens.length) await db.delete(p).where(inArray(p.token, [...tokens]));
		},
	};
}
