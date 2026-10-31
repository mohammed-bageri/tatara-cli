import { prismaNotificationStore } from "@tatara/notifications/prisma";
import { db } from "#core/db/client";

export const notificationStore = prismaNotificationStore(db);
