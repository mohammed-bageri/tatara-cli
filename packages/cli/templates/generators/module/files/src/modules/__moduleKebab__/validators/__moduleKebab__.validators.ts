import { z } from "@hono/zod-openapi";

export const __moduleCamel__StatusSchema = z
	.object({ module: z.string(), status: z.literal("ok") })
	.openapi("__modulePascal__Status");
