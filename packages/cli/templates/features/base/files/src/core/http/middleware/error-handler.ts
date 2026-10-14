import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "#core/http/context";
import { AppError } from "#core/http/errors";
// tatara:slot imports

export function errorHandler(err: Error, c: Context<AppEnv>) {
	if (err instanceof AppError) {
		let message = err.message;
		// tatara:slot error-message
		return c.json(
			{
				success: false as const,
				error: message,
				code: err.code,
				...(err.details === undefined ? {} : { details: err.details }),
			},
			err.status,
		);
	}
	if (err instanceof HTTPException) {
		return c.json(
			{ success: false as const, error: err.message || "Request failed", code: "HTTP_ERROR" },
			err.status,
		);
	}
	c.get("logger").error({ err }, "unhandled error");
	return c.json(
		{ success: false as const, error: "Something went wrong", code: "INTERNAL_ERROR" },
		500,
	);
}

export function notFoundHandler(c: Context<AppEnv>) {
	return c.json({ success: false as const, error: "Route not found", code: "NOT_FOUND" }, 404);
}
