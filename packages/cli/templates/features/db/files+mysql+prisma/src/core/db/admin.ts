// This app uses MySQL through the mariadb driver (Prisma adapter).
export {
	commandLedger,
	connectionConfig,
	dropAllTables,
	ensureDatabase,
	truncateAllTables,
} from "@tatara/db/mariadb";
