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
	/**
	 * When `deploy` runs it: "deploy" on every deploy (it must be idempotent), "once" the first time
	 * for each database (recorded in the ledger). Without a phase it only runs when asked for.
	 */
	phase?: "deploy" | "once";
	/** deploy order, lowest first (default 100) */
	order?: number;
	run(args: z.infer<S>, ctx: CommandContext): Promise<void> | void;
}

/** Which "once" commands have run; `@tatara/db` has one per database. */
export interface CommandLedger {
	completed(): Promise<Set<string>>;
	record(run: { name: string; phase: "deploy" | "once"; durationMs: number }): Promise<void>;
	/** holds a database lock for the whole deploy, so two instances deploying at once take turns */
	exclusive?<T>(fn: () => Promise<T>): Promise<T>;
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

/**
 * The `deploy` command: every "deploy" command, then each "once" command the ledger hasn't seen, in
 * `order`. Stops at the first failure, so a deploy never half-applies silently.
 */
export async function runDeploy(
	commands: readonly CommandDefinition[],
	logger: CoreLogger,
	ledger?: CommandLedger,
): Promise<number> {
	const due = commands
		.filter((c) => c.phase)
		.sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.name.localeCompare(b.name));
	// all of them, before any runs: finding out halfway would leave a deploy half-applied
	for (const command of due) {
		const parsed = command.args?.safeParse({});
		if (parsed && !parsed.success) {
			logger.error(
				{ command: command.name, issues: parsed.error.issues },
				"a deploy command can't need arguments",
			);
			return 1;
		}
	}
	const run = async (): Promise<number> => {
		// read when the first "once" command comes up: by then migrations (order 0) made the ledger
		let done: Set<string> | undefined;
		for (const command of due) {
			const log = logger.child({ command: command.name, phase: command.phase });
			const once = command.phase === "once";
			try {
				if (once) {
					if (!ledger) {
						log.warn("skipped: running a command once needs a ledger");
						continue;
					}
					done ??= await ledger.completed();
					if (done.has(command.name)) continue;
				}
				const started = performance.now();
				await command.run(command.args ? command.args.parse({}) : {}, { logger: log });
				const durationMs = Math.round(performance.now() - started);
				// unrecorded, a once command runs again next deploy: so it fails this one, loudly
				if (once) await ledger?.record({ name: command.name, phase: "once", durationMs });
				log.info({ durationMs }, "ran");
			} catch (error) {
				log.error({ err: error }, "deploy failed");
				return 1;
			}
		}
		return 0;
	};
	if (!ledger?.exclusive) return run();
	try {
		return await ledger.exclusive(run);
	} catch (error) {
		logger.error({ err: error }, "deploy could not take the deploy lock");
		return 1;
	}
}

/** Runs the command named by argv[0] (or `deploy`); returns the process exit code. */
export async function runCommand(
	commands: readonly CommandDefinition[],
	argv: string[],
	logger: CoreLogger,
	options: { ledger?: CommandLedger } = {},
): Promise<number> {
	const [name, ...rest] = argv;
	if (name === "deploy" && !commands.some((c) => c.name === "deploy"))
		return runDeploy(commands, logger, options.ledger);
	if (!name || name === "--list" || name === "list" || name === "help") {
		const width = Math.max(0, ...commands.map((c) => c.name.length));
		console.log("Commands:");
		console.log(
			`  ${"deploy".padEnd(width)}  Run the deploy and once commands (on every deploy, after migrations)`,
		);
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
