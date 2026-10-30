import type { CoreLogger } from "@tatara/core";

export interface SeedDefinition {
	name: string;
	/** lower runs first */
	order?: number;
	/** must be idempotent: seeds run on every `tatara dev` */
	run(ctx: { logger: CoreLogger }): Promise<void>;
}

/** Default export of every `db/seed.ts`; discovered by `tatara sync`. */
export function defineSeed(definition: SeedDefinition): SeedDefinition {
	return definition;
}
