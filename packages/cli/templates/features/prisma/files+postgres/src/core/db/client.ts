import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "#core/config/env";
import { registerReadinessCheck } from "@tatara/core";
import { onShutdown } from "@tatara/core";
import { type Prisma, PrismaClient } from "#generated/prisma/client";

export const db = new PrismaClient({
	adapter: new PrismaPg({ connectionString: env.DATABASE_URL, max: env.DATABASE_POOL_MAX }),
});

export type Database = typeof db;
export type Transaction = Prisma.TransactionClient;
/** `db` or an open transaction; services take an Executor so callers can compose them. */
export type Executor = Database | Transaction;

registerReadinessCheck("database", async () => {
	await db.$queryRaw`SELECT 1`;
});
onShutdown("database", () => db.$disconnect());
