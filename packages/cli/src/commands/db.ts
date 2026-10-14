import pc from "picocolors";
import type { Project } from "../project/config.ts";
import { runAppCli, runBin } from "./app-cli.ts";
import { sync } from "./sync.ts";

export class DbError extends Error {}

function requireDb(project: Project) {
	if (project.config.orm === "none") throw new DbError("This app has no database.");
}

export async function dbGenerate(project: Project, name = "change"): Promise<number> {
	requireDb(project);
	await sync(project);
	if (project.config.orm === "drizzle")
		return runBin(project, "drizzle-kit", ["generate", "--name", name]);
	return runBin(project, "prisma", ["migrate", "dev", "--create-only", "--name", name]);
}

export async function dbMigrate(project: Project): Promise<number> {
	requireDb(project);
	await sync(project);
	return runAppCli(project, ["db:migrate"]);
}

export async function dbSeed(project: Project): Promise<number> {
	requireDb(project);
	await sync(project);
	return runAppCli(project, ["db:seed"]);
}

export async function dbReset(project: Project): Promise<number> {
	requireDb(project);
	await sync(project);
	const code = await runAppCli(project, ["db:reset"]);
	return code === 0 ? runAppCli(project, ["db:seed"]) : code;
}

export async function dbStudio(project: Project): Promise<number> {
	requireDb(project);
	console.log(pc.dim("Opening the database studio…"));
	if (project.config.orm === "drizzle") return runBin(project, "drizzle-kit", ["studio"]);
	return runBin(project, "prisma", ["studio"]);
}
