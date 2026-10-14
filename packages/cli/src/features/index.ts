import { base, bun, npm, pnpm } from "./base.ts";
import type { Feature } from "./types.ts";

export const FEATURES: Record<string, Feature> = Object.fromEntries(
	[base, pnpm, npm, bun].map((f) => [f.id, f]),
);
