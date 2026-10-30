import { assertGrantValid, InvalidGrantError, META_RESOURCES } from "#core/authz/catalog";
import type { Scope } from "#core/authz/constants";
import type { PermissionGrant } from "#core/authz/types";
import { BusinessRuleError } from "@tatara/http";
import { catalog } from "#generated/permissions";

/** Validates grants against the catalog; custom roles and overlays may not grant meta resources. */
export function validateGrants(
	grants: { resource: string; action: string; scope?: string | null }[],
	options: { allowMeta: boolean },
): PermissionGrant[] {
	return grants.map((grant) => {
		try {
			assertGrantValid(catalog, grant);
		} catch (error) {
			if (error instanceof InvalidGrantError) {
				throw new BusinessRuleError("INVALID_GRANT", error.message);
			}
			throw error;
		}
		if (!options.allowMeta && META_RESOURCES.has(grant.resource)) {
			throw new BusinessRuleError(
				"META_GRANT_FORBIDDEN",
				`${grant.resource}:${grant.action} can only be granted by built-in roles`,
			);
		}
		return { resource: grant.resource, action: grant.action, scope: (grant.scope as Scope) ?? null };
	});
}
