import type { Hook } from "@hono/zod-openapi";
import { ValidationError } from "./errors.ts";

// biome-ignore lint/suspicious/noExplicitAny: the hook is shared by every route schema
export const validationHook: Hook<any, any, any, any> = (result) => {
	if (!result.success) {
		throw new ValidationError(
			undefined,
			result.error.issues.map((issue) => ({
				path: issue.path.join("."),
				message: issue.message,
				code: issue.code,
			})),
		);
	}
};
