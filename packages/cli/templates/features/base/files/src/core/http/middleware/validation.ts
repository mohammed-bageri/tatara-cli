import type { Hook } from "@hono/zod-openapi";
import type { AppEnv } from "#core/http/context";
import { ValidationError } from "#core/http/errors";

// biome-ignore lint/suspicious/noExplicitAny: the hook is shared by every route schema
export const validationHook: Hook<any, AppEnv, any, any> = (result) => {
	if (!result.success) {
		throw new ValidationError(
			"Invalid request",
			result.error.issues.map((issue) => ({
				path: issue.path.join("."),
				message: issue.message,
				code: issue.code,
			})),
		);
	}
};
