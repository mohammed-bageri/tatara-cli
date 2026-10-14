import { createHttpApp } from "#core/http/app";

/** Internal/staff API on its own port; every /api route requires the admin role. */
export const app = createHttpApp("admin", { title: "__APP_NAME__ admin API" });
