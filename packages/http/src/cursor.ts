import { z } from "@hono/zod-openapi";
import { AppError } from "./errors.ts";

export const cursorQuerySchema = z.object({
	cursor: z.string().max(512).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CursorQuery = z.infer<typeof cursorQuerySchema>;

export const cursorMetaSchema = z
	.object({ nextCursor: z.string().nullable() })
	.openapi("CursorMeta");

export function cursorPageSchema<T extends z.ZodType>(item: T) {
	return z.object({ success: z.literal(true), data: z.array(item), meta: cursorMetaSchema });
}

/** An opaque cursor: base64url JSON of where the next page starts (e.g. `{ createdAt, id }`). */
export function encodeCursor(position: unknown): string {
	return Buffer.from(JSON.stringify(position)).toString("base64url");
}

/** The position in `cursor`, checked against `schema`; a 400 INVALID_CURSOR when it doesn't parse. */
export function decodeCursor<T extends z.ZodType>(schema: T, cursor: string): z.infer<T> {
	try {
		return schema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
	} catch {
		throw new AppError(400, "INVALID_CURSOR", "Invalid cursor", undefined, true);
	}
}

/**
 * One page from rows fetched with `limit + 1`: the extra row only says there's another page.
 * `positionOf` gives the cursor position of the last row on this page.
 */
export function cursorPage<T>(rows: T[], limit: number, positionOf: (row: T) => unknown) {
	const data = rows.slice(0, limit);
	const last = data.at(-1);
	const nextCursor =
		rows.length > limit && last !== undefined ? encodeCursor(positionOf(last)) : null;
	return { success: true as const, data, meta: { nextCursor } };
}
