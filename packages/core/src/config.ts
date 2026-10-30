import type { z } from "zod";

/**
 * `localDefault(schema, value)`: a default for local development that production must set
 * explicitly. The app passes `production`; packages never read the environment.
 */
export function createLocalDefault(production: boolean) {
	return function localDefault<T extends z.ZodType>(schema: T, value: z.input<T>): T {
		return production ? schema : (schema.default(value as never) as unknown as T);
	};
}
