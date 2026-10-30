/**
 * @tatara/db: ids and seeds. Driver helpers live in sub-paths so an app loads only its own:
 * `@tatara/db/postgres` | `/mariadb` | `/mysql2` (ensureDatabase, dropAllTables, truncateAllTables)
 * and `@tatara/db/prisma` | `/drizzle-postgres` | `/drizzle-mysql` (migrateDatabase).
 */
export { newId } from "./id.ts";
export { defineSeed, type SeedDefinition } from "./seed.ts";
