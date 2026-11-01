import { boolean, index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

// milliseconds, like the Date a cursor carries: finer and rows would fall between pages
const ts = () => timestamp({ withTimezone: true, mode: "date", precision: 3 });

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
		// each channel is taken once, by a conditional update on its column
		sentInApp: boolean().notNull().default(false),
		sentEmail: boolean().notNull().default(false),
		sentSms: boolean().notNull().default(false),
		sentPush: boolean().notNull().default(false),
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
