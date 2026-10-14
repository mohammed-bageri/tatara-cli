import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const createdAt = () => timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow();
const updatedAt = () => timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow();

export const users = pgTable("users", {
	id: text().primaryKey(),
	name: text().notNull(),
	email: text().notNull().unique(),
	emailVerified: boolean().notNull().default(false),
	image: text(),
	// tatara:slot user-fields
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const sessions = pgTable("sessions", {
	id: text().primaryKey(),
	expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
	token: text().notNull().unique(),
	ipAddress: text(),
	userAgent: text(),
	userId: text()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	// tatara:slot session-fields
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const accounts = pgTable("accounts", {
	id: text().primaryKey(),
	accountId: text().notNull(),
	providerId: text().notNull(),
	userId: text()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
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

export const verifications = pgTable("verifications", {
	id: text().primaryKey(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});
