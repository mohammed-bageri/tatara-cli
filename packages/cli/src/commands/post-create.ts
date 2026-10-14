import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { x } from "tinyexec";
import { generate } from "../generators/index.ts";
import type { Project } from "../project/config.ts";

async function bin(project: Project, name: string, args: string[]) {
	const result = await x(join(project.root, "node_modules/.bin", name), args, {
		nodeOptions: { cwd: project.root },
		throwOnError: false,
	});
	if (result.exitCode !== 0) {
		throw new Error(`${name} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
	}
	return result.stdout;
}

/** Writes the first migration offline, from the schema the chosen features produced. */
export async function initialMigration(project: Project): Promise<void> {
	if (project.config.orm === "drizzle") {
		await bin(project, "drizzle-kit", ["generate", "--name", "init"]);
	} else if (project.config.orm === "prisma") {
		const dir = join(project.root, "prisma/migrations/00000000000000_init");
		await mkdir(dir, { recursive: true });
		await bin(project, "prisma", [
			"migrate",
			"diff",
			"--from-empty",
			"--to-schema",
			"prisma",
			"--script",
			"--output",
			join(dir, "migration.sql"),
		]);
		const lock = join(project.root, "prisma/migrations/migration_lock.toml");
		if (!existsSync(lock)) {
			await writeFile(
				lock,
				`# Do not edit: managed by Prisma Migrate\nprovider = "${project.config.database === "mysql" ? "mysql" : "postgresql"}"\n`,
			);
		}
	}
}

/** Steps `tatara new` runs after writing files ("files") and after installing ("installed"). */
export async function afterCreate(project: Project, stage: "files" | "installed"): Promise<void> {
	if (stage === "files" && project.has("db")) {
		await generate(project, {
			kind: "resource",
			name: "project",
			module: "projects",
			skipPostProcess: true,
		});
	}
	if (stage === "installed") await initialMigration(project);
}
