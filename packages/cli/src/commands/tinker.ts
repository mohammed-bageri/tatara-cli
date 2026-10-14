import { spawn } from "node:child_process";
import { glob } from "tinyglobby";
import { names } from "../engine/names.ts";
import type { Project } from "../project/config.ts";
import { NODE_FLAGS } from "./app-cli.ts";
import { sync } from "./sync.ts";

/** A REPL with env, logger, db and every module's services loaded. */
export async function tinker(project: Project): Promise<number> {
	await sync(project);
	const services = await glob(["src/modules/*/services/*.ts"], {
		cwd: project.root,
		ignore: ["**/*.test.ts"],
	});
	const imports = services.map((file) => {
		const [, moduleName = "", base = ""] =
			/src\/modules\/([^/]+)\/services\/([^/]+)\.ts$/.exec(file) ?? [];
		const key = names(`${moduleName} ${base.replace(/\.service$/, "")}`).camel;
		return `ctx[${JSON.stringify(key)}] = await import(${JSON.stringify(`#${file.slice(4, -3)}`)});`;
	});
	const code = `
import repl from "node:repl";
const ctx = {};
ctx.env = (await import("#core/config/env")).env;
ctx.logger = (await import("#core/logging/logger")).logger;
${project.has("db") ? 'Object.assign(ctx, await import("#core/db/client"));' : ""}
${imports.join("\n")}
console.log("Loaded:", Object.keys(ctx).join(", "));
const server = repl.start({ prompt: "${project.config.name}> " });
Object.assign(server.context, ctx);
server.on("exit", () => process.exit(0));
`;
	return new Promise((resolve) => {
		const child = spawn(process.execPath, [...NODE_FLAGS, "--input-type=module", "-e", code], {
			cwd: project.root,
			stdio: "inherit",
		});
		child.on("exit", (c) => resolve(c ?? 0));
	});
}
