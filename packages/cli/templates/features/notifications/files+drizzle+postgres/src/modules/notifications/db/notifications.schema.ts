import { boolean, index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

const ts = () => timestamp({ withTimezone: true, mode: "date" });

/** One row per user per notification; `in_app` false rows only record what was sent. */
export const notifications = pgTable(
	"notifications",
	{
		id: varchar({ length: 36 }).primaryKey(),
		orgId: varchar({ length: 255 }).notNull(),
		userId: varchar({ length: 255 }).notNull(),
		name: varchar({ length: 255 }).notNull(),
		title: text().notNull(),
		body: text(),
		url: text(),
		inApp: boolean().notNull().default(true),
		idempotencyKey: varchar({ length: 255 }).notNull().unique(),
		sentChannels: varchar({ length: 64 }).notNull().default(""),
		readAt: ts(),
		createdAt: ts().notNull().defaultNow(),
	},
	(t) => [index("notifications_inbox").on(t.orgId, t.userId, t.createdAt)],
);

/** Devices that receive push, by FCM token. */
export const pushTokens = pgTable(
	"push_tokens",
	{
		token: varchar({ length: 512 }).primaryKey(),
		userId: varchar({ length: 255 }).notNull(),
		device: varchar({ length: 255 }),
		createdAt: ts().notNull().defaultNow(),
		lastSeenAt: ts().notNull().defaultNow(),
	},
	(t) => [index("push_tokens_user").on(t.userId)],
);
