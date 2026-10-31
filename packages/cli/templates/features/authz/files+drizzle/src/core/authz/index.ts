import { createAuthz } from "@tatara/authz";
import { drizzleAuthzStore } from "@tatara/authz/drizzle";
import * as tables from "#core/authz/db/authz.schema";
import { SYSTEM_ROLES } from "#core/authz/system-roles";
import { db } from "#core/db/client";
import { catalog, type PermissionKey } from "#generated/permissions";

/** The app's authorization: its tables (authz.schema.ts), the catalog from `tatara sync`, built-in roles. */
export const authz = createAuthz<PermissionKey>({
	store: drizzleAuthzStore(db, tables),
	catalog,
	systemRoles: SYSTEM_ROLES,
});

export const { checkPermission, removeMemberAccess, requirePermission, resolveScope } = authz;
