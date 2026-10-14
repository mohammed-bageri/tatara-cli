import { auth } from "#core/auth/auth";
import { newId } from "#core/db/id";
// tatara:slot imports

export interface AsUserOptions {
	email?: string;
	name?: string;
	/** user roles (admin plugin); ignored without organizations + roles */
	roles?: string[];
	// tatara:slot options
}

/** Creates a verified user and returns their id. */
export async function createTestUser(options: AsUserOptions = {}): Promise<string> {
	const ctx = await auth.$context;
	const user = await ctx.internalAdapter.createUser({
		email: options.email ?? `user-${newId()}@example.com`,
		name: options.name ?? "Test User",
		emailVerified: true,
		// tatara:slot user-fields
	}, { method: "admin" });
	return user.id;
}

/** A new user with a real session; the token is sent as a bearer token. */
export async function authenticate(
	options: AsUserOptions = {},
): Promise<{ userId: string; headers: Record<string, string> }> {
	const userId = await createTestUser(options);
	const ctx = await auth.$context;
	const session = await ctx.internalAdapter.createSession(userId);
	return { userId, headers: { authorization: `Bearer ${session.token}` } };
}

/** Headers that authenticate as a new user. */
export async function asUser(options: AsUserOptions = {}): Promise<Record<string, string>> {
	const user = await authenticate(options);
	// tatara:slot as-user
	return user.headers;
}
