/** Test helpers: real users and sessions through better-auth, with no HTTP round trip. */

export interface TestAuth {
	$context: Promise<{
		internalAdapter: {
			createUser(user: Record<string, unknown>, ctx?: unknown): Promise<{ id: string }>;
			createSession(userId: string): Promise<{ token: string }>;
		};
	}>;
}

export interface TestUser {
	email?: string;
	name?: string;
	/** extra user columns, e.g. `role` from the admin plugin */
	fields?: Record<string, unknown>;
}

/** Creates a verified user and returns their id. */
export async function createTestUser(auth: TestAuth, user: TestUser = {}): Promise<string> {
	const ctx = await auth.$context;
	const created = await ctx.internalAdapter.createUser(
		{
			email: user.email ?? `user-${crypto.randomUUID()}@example.com`,
			name: user.name ?? "Test User",
			emailVerified: true,
			...user.fields,
		},
		{ method: "admin" },
	);
	return created.id;
}

/** Headers carrying a new session for the user, as a bearer token. */
export async function sessionHeaders(
	auth: TestAuth,
	userId: string,
): Promise<Record<string, string>> {
	const ctx = await auth.$context;
	const session = await ctx.internalAdapter.createSession(userId);
	return { authorization: `Bearer ${session.token}` };
}
