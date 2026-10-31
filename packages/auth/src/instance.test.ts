import { createApp, type HttpEnv, handleErrors } from "@tatara/http";
import { memoryAdapter } from "better-auth/adapters/memory";
import { bearer, organization } from "better-auth/plugins";
import { pino } from "pino";
import { describe, expect, expectTypeOf, it } from "vitest";
import { type AuthEnv, createAuthInstance, currentPrincipal, type Principal } from "./index.ts";
import { createTestUser, sessionHeaders } from "./testing.ts";

interface Env extends HttpEnv {
	Variables: HttpEnv["Variables"] & AuthEnv["Variables"];
}

const db: Record<string, Record<string, unknown>[]> = {
	user: [],
	session: [],
	account: [],
	verification: [],
	organization: [],
	member: [],
	invitation: [],
};

const service: Principal = {
	userId: "svc",
	orgId: "org-svc",
	orgRole: null,
	roles: [],
	kind: "service",
	claims: {},
};

const { auth, attachPrincipal, requireOrg } = createAuthInstance(
	{
		secret: "test-secret-that-is-at-least-32-characters",
		baseURL: "http://localhost",
		database: memoryAdapter(db),
		plugins: [bearer(), organization()],
	},
	{ resolvers: [() => (c) => (c.req.header("x-service") ? service : null)] },
);

function app() {
	const app = createApp<Env>({
		logger: pino({ level: "silent" }),
		cors: { origins: [] },
		bodyLimitBytes: 1024,
		defaults: { principal: null },
	});
	app.use(attachPrincipal);
	app.get("/org", requireOrg(), (c) => c.json(currentPrincipal(c)));
	handleErrors(app);
	return app;
}

async function member(role = "member") {
	const owner = await createTestUser(auth);
	const org = await auth.api.createOrganization({
		body: { name: "School", slug: `s-${crypto.randomUUID()}`, userId: owner },
	});
	const userId = await createTestUser(auth);
	await auth.api.addMember({
		body: { userId, organizationId: org?.id as string, role: role as "member" },
	});
	return { orgId: org?.id as string, userId, headers: await sessionHeaders(auth, userId) };
}

describe("createAuthInstance", () => {
	it("returns the real better-auth instance, with its plugins' API typed", () => {
		expectTypeOf(auth.api.createOrganization).toBeFunction();
		expect(typeof auth.handler).toBe("function");
	});

	it("resolves the session first, then the app's resolvers", async () => {
		const res = await app().request("/org", {
			headers: { "x-service": "1", "x-org-id": "org-svc" },
		});
		expect(await res.json()).toMatchObject({ userId: "svc", kind: "service" });
	});
});

describe("requireOrg", () => {
	it("takes the org from x-org-id and checks membership, setting orgRole", async () => {
		const { orgId, userId, headers } = await member("teacher");
		const res = await app().request("/org", { headers: { ...headers, "x-org-id": orgId } });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ userId, orgId, orgRole: "teacher" });
	});

	it("answers 400 ORG_REQUIRED without an org, and 403 for a non-member", async () => {
		const { orgId } = await member();
		const outsider = await createTestUser(auth);
		const headers = await sessionHeaders(auth, outsider);
		const none = await app().request("/org", { headers });
		expect(none.status).toBe(400);
		expect(await none.json()).toMatchObject({ code: "ORG_REQUIRED" });
		expect(
			(await app().request("/org", { headers: { ...headers, "x-org-id": orgId } })).status,
		).toBe(403);
	});

	it("401s without a principal", async () => {
		expect((await app().request("/org", { headers: { "x-org-id": "x" } })).status).toBe(401);
	});

	it("lets a service principal act only in its own org", async () => {
		expect(
			(await app().request("/org", { headers: { "x-service": "1", "x-org-id": "elsewhere" } }))
				.status,
		).toBe(403);
	});
});
