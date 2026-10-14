import { mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const __namePluralCamel__ = mysqlTable("__namePluralSnake__", {
	id: varchar({ length: 36 }).primaryKey(),
	name: varchar({ length: 200 }).notNull(),
	description: text(),
	createdAt: timestamp({ fsp: 3, mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp({ fsp: 3, mode: "date" }).notNull().defaultNow(),
});
