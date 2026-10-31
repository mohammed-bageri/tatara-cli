import { createAuthz } from "@tatara/authz";
import { store } from "#core/authz/db/store";
import { SYSTEM_ROLES } from "#core/authz/system-roles";
import { catalog, type PermissionKey } from "#generated/permissions";

/** The app's authorization: its store, the permission catalog from `tatara sync`, built-in roles. */
export const authz = createAuthz<PermissionKey>({ store, catalog, systemRoles: SYSTEM_ROLES });

export const { checkPermission, removeMemberAccess, requirePermission, resolveScope } = authz;
