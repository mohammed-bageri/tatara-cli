import { z } from "zod";
import type { Logger } from "#core/logging/logger";

export interface CommandContext {
	logger: Logger;
}

export interface CommandDefinition<S extends z.ZodType = z.ZodType> {
	/** `module:action`, e.g. "billing:recalculate" */
	name: string;
	description: string;
	/** flags parsed from `--key value`; use z.coerce for numbers and booleans */
	args?: S;
	run(args: z.infer<S>, ctx: CommandContext): Promise<void> | void;
}


/** Default export of every `commands/*.ts`; discovered by `tatara sync`. */
export function defineCommand<S extends z.ZodType = typeof noArgs>(
	definition: CommandDefinition<S>,
): CommandDefinition<S> {
	return definition;
}

export const noArgs = z.object({});
