import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { env } from "#core/config/env";
import { connectionConfig } from "#core/db/admin";
import { registerReadinessCheck } from "@tatara/core";
import { onShutdown } from "@tatara/core";
import { type Prisma, PrismaClient } from "#generated/prisma/client";

export const db = new PrismaClient({
	adapter: new PrismaMariaDb({
		...connectionConfig(env.DATABASE_URL),
		connectionLimit: env.DATABASE_POOL_MAX,
	}),
});

export type Database = typeof db;
export type Transaction = Prisma.TransactionClient;
/** `db` or an open transaction; services take an Executor so callers can compose them. */
export type Executor = Database | Transaction;

registerReadinessCheck("database", async () => {
	await db.$queryRaw`SELECT 1`;
});
onShutdown("database", () => db.$disconnect());
