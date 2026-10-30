import type { UpgradeContext } from "./context.ts";

export interface Codemod {
	/** CLI version that introduces it; runs when an app upgrades across this version */
	version: string;
	id: string;
	description: string;
	run(ctx: UpgradeContext): Promise<void>;
}

/** Every codemod tatara ships, oldest first. Each step that moves code into a package adds one. */
export const CODEMODS: readonly Codemod[] = [];
