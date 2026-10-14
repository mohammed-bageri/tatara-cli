import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "#core/auth/db/auth.schema";

export const organizations = pgTable("organizations", {
	id: text().primaryKey(),
	name: text().notNull(),
	slug: text().notNull().unique(),
	logo: text(),
	metadata: text(),
	createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const members = pgTable("members", {
	id: text().primaryKey(),
	organizationId: text()
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	userId: text()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	role: text().notNull().default("member"),
	createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const invitations = pgTable("invitations", {
	id: text().primaryKey(),
	organizationId: text()
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	email: text().notNull(),
	role: text(),
	status: text().notNull().default("pending"),
	expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
	inviterId: text()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
});
