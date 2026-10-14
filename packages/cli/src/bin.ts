#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { check } from "./commands/check.ts";
import { newApp } from "./commands/new.ts";
import { sync } from "./commands/sync.ts";
import { verify } from "./commands/verify.ts";
import { OptionsError } from "./engine/resolve.ts";
import { cliVersion } from "./paths.ts";
import { NotATataraProject } from "./project/config.ts";

const program = new Command("tatara")
	.description("Create and grow opinionated Hono backends")
	.version(cliVersion());

program
	.command("new")
	.description("Create a new app")
	.argument("[dir]", "directory to create")
	.option("--orm <orm>", "drizzle | prisma | none")
	.option("--db <database>", "postgres | mysql | none")
	.option("--auth <provider>", "better-auth | keycloak | none")
	.option("--auth-methods <list>", "email-otp,phone-otp,password,orgs (better-auth)")
	.option("--addons <list>", "authz,jobs,admin,storage,email,i18n")
	.option("--pm <pm>", "pnpm | npm | bun")
	.option("-y, --yes", "skip prompts and use flags/defaults")
	.option("--no-install", "do not install dependencies")
	.option("--no-git", "do not initialise git")
	.action(async (dir, flags) => {
		await newApp(dir, flags);
	});

program
	.command("sync")
	.description("Regenerate src/generated from discovered module files")
	.option("--quiet", "no output")
	.action(async (flags: { quiet?: boolean }) => {
		const { written } = await sync();
		if (!flags.quiet && written.length > 0) console.log(pc.dim(`tatara sync: ${written.length} file(s) updated`));
	});

program
	.command("check")
	.description("Check layout rules (part of lint)")
	.option("--json", "machine-readable output")
	.action(async (flags: { json?: boolean }) => {
		const violations = await check();
		if (flags.json) console.log(JSON.stringify({ violations }, null, 2));
		else if (violations.length === 0) console.log(pc.green("tatara check: layout OK"));
		else {
			for (const v of violations) console.log(`${pc.red("✖")} ${v.file}:${v.line} ${pc.dim(`[${v.rule}]`)} ${v.message}`);
			console.log(pc.red(`\n${violations.length} layout violation(s)`));
		}
		if (violations.length > 0) process.exitCode = 1;
	});

program
	.command("verify")
	.description("Lint, layout, typecheck, test and build")
	.action(async () => {
		if (!(await verify())) process.exitCode = 1;
	});

program.parseAsync().catch((error: unknown) => {
	if (error instanceof OptionsError || error instanceof NotATataraProject) {
		console.error(pc.red(error.message));
	} else {
		console.error(error);
	}
	process.exit(1);
});
