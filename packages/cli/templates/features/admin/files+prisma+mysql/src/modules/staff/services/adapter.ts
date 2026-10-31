import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "#core/db/client";

/** The staff models in prisma/models/staff.prisma (better-auth's staffUser, staffSession, ...). */
export const staffDatabase = prismaAdapter(db, { provider: "mysql" });
