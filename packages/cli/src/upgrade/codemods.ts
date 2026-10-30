import { corePackage } from "./codemods/core-package.ts";
import { dbTesting } from "./codemods/db-testing.ts";
import { httpPackage } from "./codemods/http-package.ts";
import type { UpgradeContext } from "./context.ts";

/**
 * A codemod must be idempotent: if a later codemod or `sync` fails, the app keeps its old version
 * and the next `tatara upgrade` runs every due codemod again, including ones that already ran.
 */
export interface Codemod {
	/** CLI version that introduces it; runs when an app upgrades across this version */
	version: string;
	id: string;
	description: string;
	run(ctx: UpgradeContext): Promise<void>;
}

/** Every codemod tatara ships, oldest first. Each step that moves code into a package adds one. */
export const CODEMODS: readonly Codemod[] = [corePackage, httpPackage, dbTesting];
