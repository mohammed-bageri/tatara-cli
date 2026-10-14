import { z } from "@hono/zod-openapi";

export const __nameCamel__QuerySchema = z.object({
	q: z.string().max(100).optional(),
});

export const __nameCamel__ResponseSchema = z
	.object({ message: z.string() })
	.openapi("__namePascal__Response");
