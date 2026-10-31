import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "#core/db/client";

export const database = prismaAdapter(db, { provider: "postgresql" });
