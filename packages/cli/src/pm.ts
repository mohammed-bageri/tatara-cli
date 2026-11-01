import type { PackageManager } from "./features/types.ts";

export interface PmCommands {
	install: string[];
	/** run a package.json script */
	run: string;
	/** run a binary from node_modules/.bin */
	exec: string;
	/** run a package without installing it into the app */
	dlx: string[];
	lockfile: string;
}

export function pmCommands(pm: PackageManager): PmCommands {
	switch (pm) {
		case "pnpm":
			return {
				install: ["pnpm", "install"],
				run: "pnpm",
				exec: "pnpm exec",
				dlx: ["pnpm", "dlx"],
				lockfile: "pnpm-lock.yaml",
			};
		case "npm":
			return {
				install: ["npm", "install"],
				run: "npm run",
				exec: "npx",
				dlx: ["npx", "-y"],
				lockfile: "package-lock.json",
			};
		case "bun":
			return {
				install: ["bun", "install"],
				run: "bun run",
				exec: "bunx",
				dlx: ["bunx"],
				lockfile: "bun.lock",
			};
	}
}
