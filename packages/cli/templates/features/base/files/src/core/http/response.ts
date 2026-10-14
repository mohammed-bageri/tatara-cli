import { z } from "@hono/zod-openapi";

export const errorSchema = z
	.object({
		success: z.literal(false),
		error: z.string(),
		code: z.string(),
		details: z.unknown().optional(),
	})
	.openapi("Error");

export const paginationMetaSchema = z
	.object({
		page: z.number().int(),
		pageSize: z.number().int(),
		total: z.number().int(),
		totalPages: z.number().int(),
	})
	.openapi("PaginationMeta");

export const paginationQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function successSchema<T extends z.ZodType>(data: T) {
	return z.object({ success: z.literal(true), data });
}

export function paginatedSchema<T extends z.ZodType>(item: T) {
	return z.object({ success: z.literal(true), data: z.array(item), meta: paginationMetaSchema });
}

export function success<T>(data: T) {
	return { success: true as const, data };
}

export function paginated<T>(data: T[], page: number, pageSize: number, total: number) {
	return {
		success: true as const,
		data,
		meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
	};
}

export function jsonContent<T extends z.ZodType>(schema: T, description: string) {
	return { content: { "application/json": { schema } }, description };
}

const ERROR_DESCRIPTIONS = {
	400: "Invalid request",
	401: "Authentication required",
	403: "Forbidden",
	404: "Not found",
	409: "Conflict",
} as const;

type ErrorStatus = keyof typeof ERROR_DESCRIPTIONS;

/** OpenAPI error responses for the given statuses, all using the shared error envelope. */
export function errorResponses<const S extends ErrorStatus[]>(...statuses: S) {
	return Object.fromEntries(
		statuses.map((status) => [status, jsonContent(errorSchema, ERROR_DESCRIPTIONS[status])]),
	) as { [K in S[number]]: ReturnType<typeof jsonContent<typeof errorSchema>> };
}
