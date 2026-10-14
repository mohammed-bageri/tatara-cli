import { z } from "@hono/zod-openapi";

export const __nameCamel__Schema = z
	.object({
		id: z.string().openapi({ example: "01920000-0000-7000-8000-000000000000" }),
		name: z.string().openapi({ example: "My __nameTitle__" }),
		description: z.string().nullable(),
		createdAt: z.string().openapi({ format: "date-time" }),
		updatedAt: z.string().openapi({ format: "date-time" }),
	})
	.openapi("__namePascal__");

export const create__namePascal__Schema = z
	.object({
		name: z.string().trim().min(1).max(200),
		description: z.string().max(5000).nullable().optional(),
	})
	.openapi("Create__namePascal__");

export const update__namePascal__Schema = create__namePascal__Schema
	.partial()
	.openapi("Update__namePascal__");

export const __nameCamel__ParamsSchema = z.object({
	id: z.string().min(1).openapi({ param: { name: "id", in: "path" } }),
});

export type __namePascal__ = z.infer<typeof __nameCamel__Schema>;
export type Create__namePascal__Input = z.infer<typeof create__namePascal__Schema>;
export type Update__namePascal__Input = z.infer<typeof update__namePascal__Schema>;
