import { SCOPES, type Scope } from "./constants.ts";

export interface ActionSpec {
	/** scoped actions are checked at own | team | org */
	readonly scoped: boolean;
}

export type ResourceSpecs = Record<string, Record<string, ActionSpec>>;

export type GrantTuple = readonly [resource: string, action: string, scope?: Scope];

export interface PermissionSlice<R extends ResourceSpecs = ResourceSpecs> {
	/** resources this module owns and the actions on them */
	readonly resources: R;
	/** grants this module adds to each built-in role, for its own resources */
	readonly roleGrants?: Partial<Record<string, readonly GrantTuple[]>>;
}

/** "resource:action" keys of one slice, for typed `requirePermission(...)` calls. */
export type PermissionKeysOf<S> =
	S extends PermissionSlice<infer R>
		? { [K in keyof R & string]: `${K}:${keyof R[K] & string}` }[keyof R & string]
		: never;

/** Default export of every `permissions/*.permissions.ts`; merged by `tatara sync`. Role keys are checked by `createAuthz`. */
export function definePermissions<const R extends ResourceSpecs>(
	slice: PermissionSlice<R>,
): PermissionSlice<R> {
	return slice;
}

export interface Catalog {
	resources: ResourceSpecs;
	keys: string[];
	roleGrants: Partial<Record<string, GrantTuple[]>>;
}

export function mergeCatalogs(...slices: PermissionSlice[]): Catalog {
	const resources: Record<string, Record<string, ActionSpec>> = {};
	const roleGrants: Partial<Record<string, GrantTuple[]>> = {};
	for (const slice of slices) {
		for (const [resource, actions] of Object.entries(slice.resources)) {
			if (resources[resource])
				throw new Error(`Permission resource "${resource}" is declared twice`);
			resources[resource] = actions;
		}
		for (const [role, grants] of Object.entries(slice.roleGrants ?? {})) {
			roleGrants[role] = [...(roleGrants[role] ?? []), ...(grants ?? [])];
		}
	}
	const keys = Object.entries(resources).flatMap(([resource, actions]) =>
		Object.keys(actions).map((action) => `${resource}:${action}`),
	);
	return { resources, keys, roleGrants };
}

/** Resources only built-in roles may grant: authorization itself. */
export const META_RESOURCES: ReadonlySet<string> = new Set(["role", "member", "audit_log"]);

export class InvalidGrantError extends Error {}

/** Throws unless (resource, action, scope) exists in the catalog with a matching scope shape. */
export function assertGrantValid(
	catalog: Catalog,
	grant: { resource: string; action: string; scope?: string | null },
): void {
	const spec = catalog.resources[grant.resource]?.[grant.action];
	if (!spec) throw new InvalidGrantError(`Unknown permission ${grant.resource}:${grant.action}`);
	const scope = grant.scope ?? null;
	if (spec.scoped && !scope) {
		throw new InvalidGrantError(
			`${grant.resource}:${grant.action} is scoped; pass one of ${SCOPES.join(", ")}`,
		);
	}
	if (spec.scoped && scope && !(SCOPES as readonly string[]).includes(scope)) {
		throw new InvalidGrantError(`Scope "${scope}" must be one of ${SCOPES.join(", ")}`);
	}
	if (!spec.scoped && scope) {
		throw new InvalidGrantError(`${grant.resource}:${grant.action} is not scoped; drop the scope`);
	}
}

export function isScoped(catalog: Catalog, resource: string, action: string): boolean {
	return catalog.resources[resource]?.[action]?.scoped === true;
}
