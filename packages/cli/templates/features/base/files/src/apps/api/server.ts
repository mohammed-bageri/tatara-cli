import { startServer } from "@tatara/http";
import { app } from "#apps/api/app";
import { env } from "#core/config/env";
import { logger } from "#core/logging/logger";
// tatara:slot imports

startServer(app, {
	port: env.PORT,
	name: "api",
	logger,
	// tatara:slot server-options
});
