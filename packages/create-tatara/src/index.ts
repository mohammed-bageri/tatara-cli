#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const cliRoot = dirname(require.resolve("@tatara/cli/package.json"));
const bin = join(cliRoot, "dist/bin.mjs");

// `npm create tatara my-app -- --orm drizzle` → `tatara new my-app --orm drizzle`
const child = spawn(process.execPath, [bin, "new", ...process.argv.slice(2)], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
