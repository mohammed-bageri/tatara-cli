/** @tatara/auth: the principal contract, guards and better-auth helpers. */
export {
	consoleSmsSender,
	createOutbox,
	type Outbox,
	type OutboxMessage,
	type SmsSender,
} from "./delivery.ts";
export { mergeAuthOpenApi, type OpenApiAuth } from "./openapi.ts";
export {
	type AuthEnv,
	attachPrincipal,
	currentPrincipal,
	type Principal,
	type PrincipalResolver,
	requireAuth,
	requireRole,
} from "./principal.ts";
export { type SessionAuth, sessionPrincipal } from "./session.ts";
