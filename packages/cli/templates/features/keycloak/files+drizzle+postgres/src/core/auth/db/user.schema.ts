import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Local copy of Keycloak users (id = token subject), created on first request. */
export const users = pgTable("users", {
	id: text().primaryKey(),
	email: text(),
	name: text(),
	createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
});
