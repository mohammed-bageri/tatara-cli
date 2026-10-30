import { versionOf } from "../../paths.ts";
import type { Codemod } from "../codemods.ts";
import type { UpgradeContext } from "../context.ts";

const CORE = "@tatara/core";

/** Files @tatara/core replaces, with the import specifier apps used for each. */
const MOVED: Record<string, string> = {
	"src/core/commands/define.ts": "#core/commands/define",
	"src/core/commands/runner.ts": "#core/commands/runner",
	"src/core/process/lifecycle.ts": "#core/process/lifecycle",
	"src/core/http/health.ts": "#core/http/health",
};

const ENV = "src/core/config/env.ts";
const LOGGER = "src/core/logging/logger.ts";
const CLI_ENTRY = "src/apps/cli/index.ts";
const SIGNAL_FILES = [
	"src/core/http/server.ts",
	"src/apps/worker/index.ts",
	"src/apps/cron/index.ts",
];
const LOGGER_IMPORT = 'import { logger } from "#core/logging/logger";';

const OLD_HELPER =
	/const production = process\.env\.NODE_ENV === "production";\n\n(\/\*\*[^\n]*\*\/\n)?function localDefault<T extends z\.ZodType>\(schema: T, value: z\.input<T>\): T \{\n\treturn production \? schema : \(schema\.default\(value as never\) as unknown as T\);\n\}\n/;

async function exists(ctx: UpgradeContext, path: string): Promise<string | undefined> {
	return ctx.read(path).catch(() => undefined);
}

/** Adds `line` after the last import, unless the file already has it. */
function withImport(text: string, line: string): string {
	if (text.includes(line)) return text;
	const imports = [...text.matchAll(/^import .*;$/gm)];
	const last = imports.at(-1);
	if (!last || last.index === undefined) return `${line}\n${text}`;
	const end = last.index + last[0].length;
	return `${text.slice(0, end)}\n${line}${text.slice(end)}`;
}

async function rewriteEnv(ctx: UpgradeContext): Promise<void> {
	const text = await exists(ctx, ENV);
	if (!text || !OLD_HELPER.test(text)) return;
	const next = withImport(
		text.replace(
			OLD_HELPER,
			'/** A default for local development; production must set the value explicitly. */\nconst localDefault = createLocalDefault(process.env.NODE_ENV === "production");\n',
		),
		'import { createLocalDefault } from "@tatara/core";',
	);
	await ctx.write(ENV, next);
}

async function passLogger(ctx: UpgradeContext): Promise<void> {
	const cli = await exists(ctx, CLI_ENTRY);
	if (cli) {
		const next = cli
			.replace(
				"runCommand(commands, process.argv.slice(2));",
				"runCommand(commands, process.argv.slice(2), logger);",
			)
			.replace("await shutdown(code);", "await shutdown(code, logger);");
		if (next !== cli) await ctx.write(CLI_ENTRY, withImport(next, LOGGER_IMPORT));
	}
	for (const path of SIGNAL_FILES) {
		const text = await exists(ctx, path);
		if (text?.includes("handleSignals();")) {
			await ctx.write(
				path,
				withImport(text.replace("handleSignals();", "handleSignals(logger);"), LOGGER_IMPORT),
			);
		}
	}
}

async function useLoggerOptions(ctx: UpgradeContext): Promise<void> {
	const text = await exists(ctx, LOGGER);
	if (!text || text.includes("loggerOptions")) return;
	if (!(await ctx.baseline.isUnchanged(LOGGER, text))) {
		ctx.report.notes.push(
			`${LOGGER} is customised and was left as is. It must still export a pino \`logger\`; @tatara/core's loggerOptions() gives the standard options.`,
		);
		return;
	}
	await ctx.write(
		LOGGER,
		`import { loggerOptions } from "@tatara/core";
import { pino } from "pino";
import { env } from "#core/config/env";

export const logger = pino(
	loggerOptions({ env: env.NODE_ENV, level: env.LOG_LEVEL, service: "${ctx.project.config.name}" }),
);

export type Logger = typeof logger;
`,
	);
}

export const corePackage: Codemod = {
	version: "0.2.0",
	id: "core-package",
	description:
		"Use @tatara/core for commands, flags, lifecycle, readiness, logger options and localDefault",
	async run(ctx) {
		await ctx.addDependency(CORE, versionOf(CORE));
		for (const [path, specifier] of Object.entries(MOVED)) {
			const status = await ctx.removeIfUnchanged(path);
			if (status === "kept") {
				ctx.report.notes.push(
					`${path} is customised; its imports still point at it. Move the change into the app or eject.`,
				);
				continue;
			}
			await ctx.rewriteImports(specifier, CORE);
		}
		await rewriteEnv(ctx);
		await passLogger(ctx);
		await useLoggerOptions(ctx);
	},
};
