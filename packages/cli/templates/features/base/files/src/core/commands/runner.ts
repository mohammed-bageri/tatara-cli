import type { CommandDefinition } from "#core/commands/define";
import { logger } from "#core/logging/logger";

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

export async function runCommand(commands: CommandDefinition[], argv: string[]): Promise<number> {
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
