import { drizzleNotificationStore } from "@tatara/notifications/drizzle";
import { db } from "#core/db/client";
import * as tables from "#modules/notifications/db/notifications.schema";

export const notificationStore = drizzleNotificationStore(db, tables);
