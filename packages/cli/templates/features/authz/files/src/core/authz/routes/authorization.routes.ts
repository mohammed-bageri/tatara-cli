import { createRoute, z } from "@hono/zod-openapi";
import { currentPrincipal, requireAuth } from "#core/auth/middleware";
import { requirePermission } from "#core/authz/middleware";
import { effectivePermissions, orgOf } from "#core/authz/resolver";
import { listAudit } from "#core/authz/services/audit";
import { addOverlay, assignRole, getMember, removeOverlay, revokeRole } from "#core/authz/services/members";
import { createRole, deleteRole, listRoles, updateRole } from "#core/authz/services/roles";
import type { OverlayRow } from "#core/authz/types";
import {
	auditEntrySchema,
	createRoleSchema,
	idParams,
	memberSchema,
	myPermissionsSchema,
	overlayInputSchema,
	roleSchema,
	updateRoleSchema,
	userOverlayParams,
	userParams,
	userRoleParams,
} from "#core/authz/validators";
import { errorResponses, jsonBody, jsonContent, success, successSchema } from "#core/http/response";
import { createRouter, defineRoutes } from "#core/http/routes";
import { catalog } from "#generated/permissions";

const router = createRouter();
const tags = ["Authorization"];
const toOverlay = (o: OverlayRow) => ({
	id: o.id,
	resource: o.resource,
	action: o.action,
	scope: o.scope,
	effect: o.effect,
	reason: o.reason,
	expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null,
});

router.openapi(
	createRoute({
		method: "get",
		path: "/catalog",
		tags,
		summary: "Every permission the API knows",
		middleware: [requireAuth()] as const,
		security: [{ bearerAuth: [] }],
		responses: {
			200: jsonContent(
				successSchema(z.object({ keys: z.array(z.string()), resources: z.record(z.string(), z.unknown()) })),
				"Permission catalog",
			),
			...errorResponses(401),
		},
	}),
	(c) => c.json(success({ keys: catalog.keys, resources: catalog.resources }), 200),
);

router.openapi(
	createRoute({
		method: "get",
		path: "/me",
		tags,
		summary: "The caller's effective permissions in their org",
		middleware: [requireAuth()] as const,
		security: [{ bearerAuth: [] }],
		responses: { 200: jsonContent(successSchema(myPermissionsSchema), "Effective permissions"), ...errorResponses(401) },
	}),
	async (c) => {
		const principal = currentPrincipal(c);
		const permissions = await effectivePermissions(principal);
		return c.json(
			success({
				orgId: orgOf(principal),
				roles: permissions.roles,
				grants: permissions.grants,
				denies: [...permissions.denies],
			}),
			200,
		);
	},
);

router.openapi(
	createRoute({
		method: "get",
		path: "/roles",
		tags,
		summary: "Built-in roles and the org's custom roles",
		middleware: [requirePermission("role:read")] as const,
		security: [{ bearerAuth: ["role:read"] }],
		responses: { 200: jsonContent(successSchema(z.array(roleSchema)), "Roles"), ...errorResponses(401, 403) },
	}),
	async (c) => c.json(success(await listRoles(orgOf(currentPrincipal(c)))), 200),
);

router.openapi(
	createRoute({
		method: "post",
		path: "/roles",
		tags,
		summary: "Create a custom role",
		middleware: [requirePermission("role:create")] as const,
		security: [{ bearerAuth: ["role:create"] }],
		request: { body: jsonBody(createRoleSchema, "The role") },
		responses: {
			201: jsonContent(successSchema(roleSchema), "Created"),
			...errorResponses(400, 409),
			...errorResponses(401, 403),
		},
	}),
	async (c) => {
		const principal = currentPrincipal(c);
		const role = await createRole(principal.userId, orgOf(principal), c.req.valid("json"));
		return c.json(success(role), 201);
	},
);

router.openapi(
	createRoute({
		method: "patch",
		path: "/roles/{id}",
		tags,
		summary: "Update a custom role",
		middleware: [requirePermission("role:update")] as const,
		security: [{ bearerAuth: ["role:update"] }],
		request: { params: idParams, body: jsonBody(updateRoleSchema, "Fields to change") },
		responses: {
			200: jsonContent(successSchema(roleSchema), "Updated"),
			...errorResponses(400, 404),
			...errorResponses(401, 403),
		},
	}),
	async (c) => {
		const principal = currentPrincipal(c);
		const role = await updateRole(principal.userId, orgOf(principal), c.req.valid("param").id, c.req.valid("json"));
		return c.json(success(role), 200);
	},
);

router.openapi(
	createRoute({
		method: "delete",
		path: "/roles/{id}",
		tags,
		summary: "Delete a custom role that no member holds",
		middleware: [requirePermission("role:delete")] as const,
		security: [{ bearerAuth: ["role:delete"] }],
		request: { params: idParams },
		responses: { 204: { description: "Deleted" }, ...errorResponses(400, 404, 409), ...errorResponses(401, 403) },
	}),
	async (c) => {
		const principal = currentPrincipal(c);
		await deleteRole(principal.userId, orgOf(principal), c.req.valid("param").id);
		return c.body(null, 204);
	},
);

router.openapi(
	createRoute({
		method: "get",
		path: "/members/{userId}",
		tags,
		summary: "A member's roles and overlays",
		middleware: [requirePermission("member:read")] as const,
		security: [{ bearerAuth: ["member:read"] }],
		request: { params: userParams },
		responses: { 200: jsonContent(successSchema(memberSchema), "Member"), ...errorResponses(401, 403) },
	}),
	async (c) => {
		const member = await getMember(orgOf(currentPrincipal(c)), c.req.valid("param").userId);
		return c.json(success({ ...member, overlays: member.overlays.map(toOverlay) }), 200);
	},
);

router.openapi(
	createRoute({
		method: "post",
		path: "/members/{userId}/roles",
		tags,
		summary: "Assign a role to a member",
		middleware: [requirePermission("member:update")] as const,
		security: [{ bearerAuth: ["member:update"] }],
		request: { params: userParams, body: jsonBody(z.object({ roleId: z.string() }), "Role") },
		responses: {
			200: jsonContent(successSchema(z.object({ assigned: z.boolean() })), "Assigned"),
			...errorResponses(404),
			...errorResponses(401, 403),
		},
	}),
	async (c) => {
		const principal = currentPrincipal(c);
		const assigned = await assignRole(
			principal.userId,
			orgOf(principal),
			c.req.valid("param").userId,
			c.req.valid("json").roleId,
		);
		return c.json(success({ assigned }), 200);
	},
);

router.openapi(
	createRoute({
		method: "delete",
		path: "/members/{userId}/roles/{roleId}",
		tags,
		summary: "Revoke a role from a member",
		middleware: [requirePermission("member:update")] as const,
		security: [{ bearerAuth: ["member:update"] }],
		request: { params: userRoleParams },
		responses: { 204: { description: "Revoked" }, ...errorResponses(404), ...errorResponses(401, 403) },
	}),
	async (c) => {
		const principal = currentPrincipal(c);
		const { userId, roleId } = c.req.valid("param");
		await revokeRole(principal.userId, orgOf(principal), userId, roleId);
		return c.body(null, 204);
	},
);

router.openapi(
	createRoute({
		method: "post",
		path: "/members/{userId}/overlays",
		tags,
		summary: "Grant or deny one permission to a member",
		middleware: [requirePermission("member:update")] as const,
		security: [{ bearerAuth: ["member:update"] }],
		request: { params: userParams, body: jsonBody(overlayInputSchema, "Overlay") },
		responses: {
			201: jsonContent(successSchema(z.object({ id: z.string() })), "Created"),
			...errorResponses(400),
			...errorResponses(401, 403),
		},
	}),
	async (c) => {
		const principal = currentPrincipal(c);
		const body = c.req.valid("json");
		const id = await addOverlay(principal.userId, orgOf(principal), c.req.valid("param").userId, {
			...body,
			expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
		});
		return c.json(success({ id }), 201);
	},
);

router.openapi(
	createRoute({
		method: "delete",
		path: "/members/{userId}/overlays/{overlayId}",
		tags,
		summary: "Remove an overlay",
		middleware: [requirePermission("member:update")] as const,
		security: [{ bearerAuth: ["member:update"] }],
		request: { params: userOverlayParams },
		responses: { 204: { description: "Removed" }, ...errorResponses(404), ...errorResponses(401, 403) },
	}),
	async (c) => {
		const principal = currentPrincipal(c);
		const { userId, overlayId } = c.req.valid("param");
		await removeOverlay(principal.userId, orgOf(principal), userId, overlayId);
		return c.body(null, 204);
	},
);

router.openapi(
	createRoute({
		method: "get",
		path: "/audit",
		tags,
		summary: "Recent authorization changes in the org",
		middleware: [requirePermission("audit_log:read")] as const,
		security: [{ bearerAuth: ["audit_log:read"] }],
		responses: { 200: jsonContent(successSchema(z.array(auditEntrySchema)), "Audit log"), ...errorResponses(401, 403) },
	}),
	async (c) => {
		const rows = await listAudit(orgOf(currentPrincipal(c)));
		return c.json(success(rows.map((r) => ({ ...r, at: r.at.toISOString() }))), 200);
	},
);

export default defineRoutes({ app: "api", basePath: "/authorization", router });
