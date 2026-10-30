import { createTestUser as createUser, sessionHeaders } from "@tatara/auth/testing";
import { auth } from "#core/auth/auth";
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
	return createUser(auth, {
		email: options.email,
		name: options.name,
		fields: {
			// tatara:slot user-fields
		},
	});
}

/** A new user with a real session; the token is sent as a bearer token. */
export async function authenticate(
	options: AsUserOptions = {},
): Promise<{ userId: string; headers: Record<string, string> }> {
	// tatara:slot authenticate
	const userId = await createTestUser(options);
	return { userId, headers: await sessionHeaders(auth, userId) };
}

/** Headers that authenticate as a new user. */
export async function asUser(options: AsUserOptions = {}): Promise<Record<string, string>> {
	const user = await authenticate(options);
	// tatara:slot as-user
	return user.headers;
}
// tatara:slot helpers
