import { mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Local copy of Keycloak users (id = token subject), created on first request. */
export const users = mysqlTable("users", {
	id: varchar({ length: 36 }).primaryKey(),
	email: varchar({ length: 255 }),
	name: varchar({ length: 255 }),
	createdAt: timestamp({ fsp: 3, mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp({ fsp: 3, mode: "date" }).notNull().defaultNow(),
});
