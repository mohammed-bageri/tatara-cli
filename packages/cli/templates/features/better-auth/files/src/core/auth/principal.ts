import { principalMiddleware, sessionPrincipal } from "@tatara/auth";
import { auth } from "#core/auth/auth";
import type { AppEnv } from "#core/http/context";
// tatara:slot imports

/** Sets `c.var.principal` from the first resolver that recognises the request's credentials. */
export const attachPrincipal = principalMiddleware<AppEnv>([
	(c) => sessionPrincipal(auth, c.req.raw.headers),
	// tatara:slot resolvers
]);
