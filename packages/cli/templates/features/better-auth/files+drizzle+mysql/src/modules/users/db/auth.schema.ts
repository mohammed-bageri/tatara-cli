import { boolean, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

const id = () => varchar({ length: 36 });
const createdAt = () => timestamp({ fsp: 3, mode: "date" }).notNull().defaultNow();
const updatedAt = () => timestamp({ fsp: 3, mode: "date" }).notNull().defaultNow();

export const users = mysqlTable("users", {
	id: id().primaryKey(),
	name: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 255 }).notNull().unique(),
	emailVerified: boolean().notNull().default(false),
	image: text(),
	// tatara:slot user-fields
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const sessions = mysqlTable("sessions", {
	id: id().primaryKey(),
	expiresAt: timestamp({ fsp: 3, mode: "date" }).notNull(),
	token: varchar({ length: 255 }).notNull().unique(),
	ipAddress: varchar({ length: 64 }),
	userAgent: text(),
	userId: id()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	// tatara:slot session-fields
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const accounts = mysqlTable("accounts", {
	id: id().primaryKey(),
	accountId: varchar({ length: 255 }).notNull(),
	providerId: varchar({ length: 64 }).notNull(),
	userId: id()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	accessToken: text(),
	refreshToken: text(),
	idToken: text(),
	accessTokenExpiresAt: timestamp({ fsp: 3, mode: "date" }),
	refreshTokenExpiresAt: timestamp({ fsp: 3, mode: "date" }),
	scope: text(),
	password: text(),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const verifications = mysqlTable("verifications", {
	id: id().primaryKey(),
	identifier: varchar({ length: 255 }).notNull(),
	value: text().notNull(),
	expiresAt: timestamp({ fsp: 3, mode: "date" }).notNull(),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});
