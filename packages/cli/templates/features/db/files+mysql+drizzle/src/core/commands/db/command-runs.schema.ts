import { sql } from "drizzle-orm";
import { datetime, int, mysqlTable, varchar } from "drizzle-orm/mysql-core";

/** Which "once" commands this database has run (written by `deploy`). */
export const tataraCommandRuns = mysqlTable("tatara_command_runs", {
	name: varchar({ length: 255 }).primaryKey(),
	phase: varchar({ length: 16 }).notNull(),
	ranAt: datetime({ fsp: 3 }).notNull().default(sql`current_timestamp(3)`),
	durationMs: int().notNull(),
});
