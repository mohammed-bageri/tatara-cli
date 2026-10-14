import { z } from "@hono/zod-openapi";

export const greetingQuerySchema = z.object({
	name: z.string().min(1).max(50).optional().openapi({ example: "Ada" }),
});

export const greetingSchema = z
	.object({ message: z.string().openapi({ example: "Hello, Ada!" }) })
	.openapi("Greeting");
