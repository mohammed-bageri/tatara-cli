import { mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import { users } from "#modules/users/db/auth.schema";

export const organizations = mysqlTable("organizations", {
	id: varchar({ length: 36 }).primaryKey(),
	name: varchar({ length: 255 }).notNull(),
	slug: varchar({ length: 255 }).notNull().unique(),
	logo: text(),
	metadata: text(),
	createdAt: timestamp({ fsp: 3, mode: "date" }).notNull().defaultNow(),
});

export const members = mysqlTable("members", {
	id: varchar({ length: 36 }).primaryKey(),
	organizationId: varchar({ length: 36 })
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	userId: varchar({ length: 36 })
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	role: varchar({ length: 64 }).notNull().default("member"),
	createdAt: timestamp({ fsp: 3, mode: "date" }).notNull().defaultNow(),
});

export const invitations = mysqlTable("invitations", {
	id: varchar({ length: 36 }).primaryKey(),
	organizationId: varchar({ length: 36 })
		.notNull()
		.references(() => organizations.id, { onDelete: "cascade" }),
	email: varchar({ length: 255 }).notNull(),
	role: varchar({ length: 64 }),
	status: varchar({ length: 32 }).notNull().default("pending"),
	expiresAt: timestamp({ fsp: 3, mode: "date" }).notNull(),
	inviterId: varchar({ length: 36 })
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	createdAt: timestamp({ fsp: 3, mode: "date" }).notNull().defaultNow(),
});
