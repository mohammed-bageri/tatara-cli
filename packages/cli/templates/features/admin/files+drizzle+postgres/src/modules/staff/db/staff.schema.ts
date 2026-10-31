// Internal staff accounts: better-auth's tables under staff_* names, apart from users.
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const createdAt = () => timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow();
const updatedAt = () => timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow();

export const staffUsers = pgTable("staff_users", {
	id: text().primaryKey(),
	name: text().notNull(),
	email: text().notNull().unique(),
	emailVerified: boolean().notNull().default(false),
	image: text(),
	/** staff role, e.g. "staff"; the admin app requires one */
	role: text().notNull().default("staff"),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const staffSessions = pgTable("staff_sessions", {
	id: text().primaryKey(),
	expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
	token: text().notNull().unique(),
	ipAddress: text(),
	userAgent: text(),
	userId: text()
		.notNull()
		.references(() => staffUsers.id, { onDelete: "cascade" }),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const staffAccounts = pgTable("staff_accounts", {
	id: text().primaryKey(),
	accountId: text().notNull(),
	providerId: text().notNull(),
	userId: text()
		.notNull()
		.references(() => staffUsers.id, { onDelete: "cascade" }),
	accessToken: text(),
	refreshToken: text(),
	idToken: text(),
	accessTokenExpiresAt: timestamp({ withTimezone: true, mode: "date" }),
	refreshTokenExpiresAt: timestamp({ withTimezone: true, mode: "date" }),
	scope: text(),
	password: text(),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const staffVerifications = pgTable("staff_verifications", {
	id: text().primaryKey(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});
