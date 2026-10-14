import { app } from "#apps/admin/app";
import { env } from "#core/config/env";
import { startServer } from "#core/http/server";

startServer(app, env.ADMIN_PORT, "admin");
