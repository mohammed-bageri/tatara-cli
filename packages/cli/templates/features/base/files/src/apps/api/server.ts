import { app } from "#apps/api/app";
import { env } from "#core/config/env";
import { startServer } from "#core/http/server";

startServer(app, env.PORT, "api");
