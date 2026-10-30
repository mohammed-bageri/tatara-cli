import { startServer } from "@tatara/http";
import { app } from "#apps/admin/app";
import { env } from "#core/config/env";
import { logger } from "#core/logging/logger";

startServer(app, { port: env.ADMIN_PORT, name: "admin", logger });
