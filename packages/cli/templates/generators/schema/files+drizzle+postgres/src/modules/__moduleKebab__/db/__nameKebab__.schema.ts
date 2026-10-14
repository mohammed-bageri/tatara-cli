import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const __namePluralCamel__ = pgTable("__namePluralSnake__", {
	id: uuid().primaryKey(),
	name: varchar({ length: 200 }).notNull(),
	description: text(),
	createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
});
