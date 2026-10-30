import { z } from "zod";
import type { CoreLogger } from "./logger.ts";

export interface CommandContext {
	logger: CoreLogger;
}

export interface CommandDefinition<S extends z.ZodType = z.ZodType> {
	/** `module:action`, e.g. "billing:recalculate" */
	name: string;
	description: string;
	/** flags parsed from `--key value`; use z.coerce for numbers and `flag()` for booleans */
	args?: S;
	run(args: z.infer<S>, ctx: CommandContext): Promise<void> | void;
}

export const noArgs = z.object({});

/** Default export of every `commands/*.ts`; discovered by `tatara sync`. */
export function defineCommand<S extends z.ZodType = typeof noArgs>(
	definition: CommandDefinition<S>,
): CommandDefinition<S> {
	return definition;
}

/**
 * A boolean flag: bare `--force` is true, `--force false|0|no|off` is false.
 * (`z.coerce.boolean()` would read the string "false" as true.)
 */
export function flag() {
	return z.union([z.boolean(), z.stringbool()]).default(false);
}

/** Parses `--key value`, `--key=value` and bare `--flag` (true) into an object. */
export function parseFlags(argv: string[]): Record<string, string | boolean> {
	const flags: Record<string, string | boolean> = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i] ?? "";
		if (!arg.startsWith("--")) continue;
		const [rawKey, inline] = arg.slice(2).split("=", 2);
		const key = (rawKey ?? "").replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
		if (inline !== undefined) {
			flags[key] = inline;
		} else if (argv[i + 1] !== undefined && !argv[i + 1]?.startsWith("--")) {
			flags[key] = argv[i + 1] ?? "";
			i++;
		} else {
			flags[key] = true;
		}
	}
	return flags;
}

/** Runs the command named by argv[0]; returns the process exit code. */
export async function runCommand(
	commands: readonly CommandDefinition[],
	argv: string[],
	logger: CoreLogger,
): Promise<number> {
	const [name, ...rest] = argv;
	if (!name || name === "--list" || name === "list" || name === "help") {
		const width = Math.max(0, ...commands.map((c) => c.name.length));
		console.log("Commands:");
		for (const c of [...commands].sort((a, b) => a.name.localeCompare(b.name))) {
			console.log(`  ${c.name.padEnd(width)}  ${c.description}`);
		}
		return 0;
	}
	const command = commands.find((c) => c.name === name);
	if (!command) {
		console.error(`Unknown command "${name}". Run with --list to see available commands.`);
		return 1;
	}
	const parsed = (command.args ?? null)?.safeParse(parseFlags(rest));
	if (parsed && !parsed.success) {
		console.error(`Invalid arguments for ${name}:`);
		for (const issue of parsed.error.issues) {
			console.error(`  --${issue.path.join(".")}: ${issue.message}`);
		}
		return 1;
	}
	try {
		await command.run(parsed ? parsed.data : {}, { logger: logger.child({ command: name }) });
		return 0;
	} catch (error) {
		logger.error({ err: error, command: name }, "command failed");
		return 1;
	}
}
