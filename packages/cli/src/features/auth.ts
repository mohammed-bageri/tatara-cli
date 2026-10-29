import type { Feature, SlotContribution } from "./types.ts";

const AGENTS_AUTH = `## Auth

- \`c.var.principal\` is set for every request with valid credentials: \`{ userId, orgId, roles, kind }\`.
- Protect routes with \`middleware: [requireAuth()]\` or \`requireRole("admin")\` from
  \`#core/auth/middleware\`, and declare \`security: [{ bearerAuth: [] }]\` so the route is
  documented as protected. Read the caller with \`currentPrincipal(c)\`.
- In tests, \`asUser()\` from \`#tests/helpers/auth\` returns headers for a fresh authenticated user.
`;

/** Provider-neutral auth: the principal contract, guards and GET /api/me. */
export const auth: Feature = {
	id: "auth",
	kind: "auth",
	label: "Auth (shared)",
	slots: [
		{
			file: "src/core/http/app.ts",
			slot: "imports",
			content: 'import { attachPrincipal } from "#core/auth/principal";',
		},
		{
			file: "src/core/http/app.ts",
			slot: "middleware",
			order: 50,
			content: "app.use(attachPrincipal);",
		},
		{
			file: "src/core/http/app.ts",
			slot: "routes",
			order: 0,
			content: [
				'app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {',
				'\ttype: "http",',
				'\tscheme: "bearer",',
				"});",
			].join("\n"),
		},
		{ file: "AGENTS.md", slot: "sections", content: AGENTS_AUTH },
	],
};

const BETTER_AUTH_AGENTS = `### better-auth

- Endpoints are served at \`/api/auth/*\` and listed in \`/openapi.json\` and \`/docs\` under the Auth tag
  (schemas prefixed \`Auth\`). better-auth's own reference is also at \`/api/auth/reference\`.
- Sessions work as cookies (browsers) and as \`Authorization: Bearer <session token>\` (mobile, APIs).
- Outside production, every email and SMS is kept in an in-memory outbox:
  \`GET /api/dev/outbox?to=<address>\` returns the latest messages, including sign-in codes.
- To send real SMS, implement \`SmsSender\` in \`src/core/auth/sms.ts\`.
`;

const drizzlePg = ["drizzle", "postgres"];
const drizzleMy = ["drizzle", "mysql"];

export const betterAuth: Feature = {
	id: "better-auth",
	kind: "auth",
	label: "better-auth",
	dependencies: ["better-auth"],
	env: [
		{
			key: "BETTER_AUTH_SECRET",
			schema: "z.string().min(32)",
			example: "replace-with-a-long-random-secret-at-least-32-chars",
			secret: true,
		},
		{
			key: "DEV_OUTBOX",
			schema: "z.stringbool().default(false)",
			example: "false",
			dev: "true",
			test: "true",
			comment:
				"Keep emails/SMS (with sign-in codes) readable at /api/dev/outbox. Development only.",
		},
		{
			key: "SEED_ADMIN_EMAIL",
			schema: 'z.email().default("admin@example.com")',
			example: "admin@example.com",
			comment: "Development admin created by `db:seed` (never in production)",
		},
	],
	slots: [
		{
			file: "src/core/http/app.ts",
			slot: "imports",
			content: 'import { auth } from "#core/auth/auth";',
		},
		{
			file: "src/core/http/app.ts",
			slot: "imports",
			content: 'import { outboxEnabled, readOutbox } from "#core/auth/delivery";',
		},
		{
			file: "src/core/http/app.ts",
			slot: "imports",
			content: 'import { mergeAuthOpenApi } from "#core/auth/openapi";',
		},
		{
			file: "src/core/http/app.ts",
			slot: "openapi",
			content: 'if (name === "api") await mergeAuthOpenApi(document, `${API_PREFIX}/auth`);',
		},
		{
			file: "src/core/http/app.ts",
			slot: "routes",
			order: 1,
			content: [
				'if (name === "api") {',
				'\tapp.on(["GET", "POST"], `${API_PREFIX}/auth/*`, (c) => auth.handler(c.req.raw));',
				"\tif (outboxEnabled()) {",
				'\t\tapp.get(`${API_PREFIX}/dev/outbox`, (c) => c.json({ messages: readOutbox(c.req.query("to")) }));',
				"\t}",
				"}",
			].join("\n"),
		},
		{
			file: "src/core/auth/delivery.ts",
			slot: "email-delivery",
			unless: ["email"],
			content:
				'logger.info({ to: message.to, subject: message.subject }, "email not sent: no email provider configured");',
		},
		{
			file: "src/core/auth/delivery.ts",
			slot: "imports",
			unless: ["email"],
			content: 'import { logger } from "#core/logging/logger";',
		},
		{
			file: "src/core/auth/delivery.ts",
			slot: "imports",
			when: ["email"],
			content: 'import { sendEmail } from "#core/email/send";',
		},
		{
			file: "src/core/auth/delivery.ts",
			slot: "email-delivery",
			when: ["email"],
			content: "await sendEmail({ to: message.to, subject: message.subject, text: message.text });",
		},
		{ file: "AGENTS.md", slot: "sections", content: BETTER_AUTH_AGENTS },
	],
};

export const authEmailOtp: Feature = {
	id: "auth-email-otp",
	kind: "auth-method",
	label: "Email OTP",
	slots: [
		{
			file: "src/core/auth/auth.ts",
			slot: "imports",
			content: 'import { deliverEmail } from "#core/auth/delivery";',
		},
		{
			file: "src/core/auth/auth.ts",
			slot: "imports",
			content: 'import { emailOTP } from "better-auth/plugins";',
		},
		{
			file: "src/core/auth/auth.ts",
			slot: "plugins",
			content: [
				"emailOTP({",
				"\tasync sendVerificationOTP({ email, otp, type }) {",
				"\t\tawait deliverEmail({",
				"\t\t\tto: email,",
				'\t\t\tsubject: "Your sign-in code",',
				"\t\t\ttext: `Your ${type} code is ${otp}. It expires in 5 minutes.`,",
				"\t\t\tcode: otp,",
				"\t\t});",
				"\t},",
				"}),",
			].join("\n"),
		},
	],
};

const phoneFields: SlotContribution[] = [
	{
		file: "src/core/auth/db/auth.schema.ts",
		slot: "user-fields",
		when: drizzlePg,
		content: "phoneNumber: text().unique(),\nphoneNumberVerified: boolean(),",
	},
	{
		file: "src/core/auth/db/auth.schema.ts",
		slot: "user-fields",
		when: drizzleMy,
		content: "phoneNumber: varchar({ length: 32 }).unique(),\nphoneNumberVerified: boolean(),",
	},
	{
		file: "prisma/models/auth.prisma",
		slot: "user-fields",
		content: [
			'phoneNumber         String?  @unique @map("phone_number") @db.VarChar(32)',
			'phoneNumberVerified Boolean? @map("phone_number_verified")',
		].join("\n"),
	},
];

export const authPhoneOtp: Feature = {
	id: "auth-phone-otp",
	kind: "auth-method",
	label: "Phone OTP",
	slots: [
		{
			file: "src/core/auth/auth.ts",
			slot: "imports",
			content: 'import { deliverSms } from "#core/auth/delivery";',
		},
		{
			file: "src/core/auth/auth.ts",
			slot: "imports",
			content: 'import { phoneNumber } from "better-auth/plugins";',
		},
		{
			file: "src/core/auth/auth.ts",
			slot: "plugins",
			content: [
				"phoneNumber({",
				"\tasync sendOTP({ phoneNumber: to, code }) {",
				"\t\tawait deliverSms({ to, text: `Your sign-in code is ${code}`, code });",
				"\t},",
				"\tsignUpOnVerification: {",
				'\t\tgetTempEmail: (phone) => `${phone.replace(/\\D/g, "")}@phone.invalid`,',
				"\t\tgetTempName: (phone) => phone,",
				"\t},",
				"}),",
			].join("\n"),
		},
		...phoneFields,
	],
};

export const authPassword: Feature = {
	id: "auth-password",
	kind: "auth-method",
	label: "Email + password",
	env: [
		{
			key: "SEED_ADMIN_PASSWORD",
			schema: "z.string().min(10).optional()",
			example: "",
			secret: true,
			comment: "Password for the development admin (generated by tatara new)",
		},
	],
	slots: [
		{
			file: "src/core/auth/auth.ts",
			slot: "imports",
			content: 'import { deliverEmail } from "#core/auth/delivery";',
		},
		{
			file: "src/core/auth/auth.ts",
			slot: "options",
			content: [
				"emailAndPassword: {",
				"\tenabled: true,",
				"\tminPasswordLength: 10,",
				"\tasync sendResetPassword({ user, url }) {",
				'\t\tawait deliverEmail({ to: user.email, subject: "Reset your password", text: `Reset your password: ${url}` });',
				"\t},",
				"},",
			].join("\n"),
		},
		{
			file: "src/core/auth/db/seed.ts",
			slot: "seed-after-user",
			content: [
				"if (env.SEED_ADMIN_PASSWORD) {",
				"\tawait ctx.internalAdapter.linkAccount({",
				"\t\tuserId: user.id,",
				'\t\tproviderId: "credential",',
				"\t\taccountId: user.id,",
				"\t\tpassword: await ctx.password.hash(env.SEED_ADMIN_PASSWORD),",
				"\t});",
				"}",
			].join("\n"),
		},
	],
};

const adminFields: SlotContribution[] = [
	{
		file: "src/core/auth/db/auth.schema.ts",
		slot: "user-fields",
		when: drizzlePg,
		content:
			'role: text(),\nbanned: boolean().default(false),\nbanReason: text(),\nbanExpires: timestamp({ withTimezone: true, mode: "date" }),',
	},
	{
		file: "src/core/auth/db/auth.schema.ts",
		slot: "user-fields",
		when: drizzleMy,
		content:
			'role: varchar({ length: 255 }),\nbanned: boolean().default(false),\nbanReason: text(),\nbanExpires: timestamp({ fsp: 3, mode: "date" }),',
	},
	{
		file: "src/core/auth/db/auth.schema.ts",
		slot: "session-fields",
		when: drizzlePg,
		content: "activeOrganizationId: text(),\nimpersonatedBy: text(),",
	},
	{
		file: "src/core/auth/db/auth.schema.ts",
		slot: "session-fields",
		when: drizzleMy,
		content:
			"activeOrganizationId: varchar({ length: 36 }),\nimpersonatedBy: varchar({ length: 36 }),",
	},
	{
		file: "prisma/models/auth.prisma",
		slot: "user-fields",
		content: [
			"role       String?   @db.VarChar(255)",
			"banned     Boolean?  @default(false)",
			'banReason  String?   @map("ban_reason") @db.Text',
			'banExpires DateTime? @map("ban_expires")',
		].join("\n"),
	},
	{
		file: "prisma/models/auth.prisma",
		slot: "user-relations",
		content: "members     Member[]\ninvitations Invitation[]",
	},
	{
		file: "prisma/models/auth.prisma",
		slot: "session-fields",
		content: [
			'activeOrganizationId String? @map("active_organization_id") @db.VarChar(36)',
			'impersonatedBy       String? @map("impersonated_by") @db.VarChar(36)',
		].join("\n"),
	},
	{
		file: "src/core/auth/adapter.ts",
		slot: "imports",
		when: ["drizzle"],
		content: 'import * as orgSchema from "#core/auth/db/organization.schema";',
	},
	{
		file: "src/core/auth/adapter.ts",
		slot: "adapter-schema",
		when: ["drizzle"],
		content:
			"organization: orgSchema.organizations,\nmember: orgSchema.members,\ninvitation: orgSchema.invitations,",
	},
];

export const authOrgs: Feature = {
	id: "auth-orgs",
	kind: "auth-method",
	label: "Organizations + roles",
	slots: [
		{
			file: "src/core/auth/auth.ts",
			slot: "imports",
			content: 'import { admin, organization } from "better-auth/plugins";',
		},
		{
			file: "src/core/auth/auth.ts",
			slot: "plugins",
			content: "organization(),\nadmin(),",
			order: 900,
		},
		{
			file: "tests/helpers/auth.ts",
			slot: "user-fields",
			content: '...(options.roles ? { role: options.roles.join(",") } : {}),',
		},
		{ file: "src/core/auth/db/seed.ts", slot: "seed-user-fields", content: 'role: "admin",' },
		...adminFields,
	],
};

const KEYCLOAK_AGENTS = `### Keycloak

- The API is a resource server: it verifies Keycloak access tokens (signature, issuer,
  audience \`__APP_NAME__-api\`, expiry). Login happens in the frontend via OIDC (PKCE) against
  the \`__APP_NAME__-web\` client.
- Roles come from the token's \`roles\` claim (realm roles) and client roles for the API.
- Local dev realm: \`keycloak/realm.json\` (users alice/alice with admin, bob/bob).
  \`__PM_EXEC__ tatara run keycloak:token --user alice\` prints a token for curl.
- Tests sign tokens with a local key; see \`#tests/helpers/auth\`.
`;

export const keycloak: Feature = {
	id: "keycloak",
	kind: "auth",
	label: "Keycloak",
	dependencies: ["jose"],
	env: [
		{
			key: "KEYCLOAK_PORT",
			schema: "",
			example: "8080",
			composeOnly: true,
			comment: "Host port for the local Keycloak container",
		},
		{
			key: "KEYCLOAK_URL",
			schema: 'z.url().default("http://localhost:8080")',
			example: "http://localhost:8080",
		},
		{
			key: "KEYCLOAK_REALM",
			schema: 'z.string().default("__APP_NAME__")',
			example: "__APP_NAME__",
		},
		{
			key: "KEYCLOAK_AUDIENCE",
			schema: 'z.string().default("__APP_NAME__-api")',
			example: "__APP_NAME__-api",
			comment: "Tokens must carry this audience",
		},
	],
	compose: {
		keycloak: {
			image: "quay.io/keycloak/keycloak:26.8.1",
			command: ["start-dev", "--import-realm"],
			environment: {
				KC_BOOTSTRAP_ADMIN_USERNAME: "admin",
				KC_BOOTSTRAP_ADMIN_PASSWORD: "admin",
				KC_HEALTH_ENABLED: "true",
				KC_HOSTNAME: "http://localhost:${KEYCLOAK_PORT:-8080}",
			},
			ports: ["${KEYCLOAK_PORT:-8080}:8080"],
			volumes: ["./keycloak:/opt/keycloak/data/import:ro"],
			healthcheck: {
				test: [
					"CMD-SHELL",
					"exec 3<>/dev/tcp/127.0.0.1/9000 && printf 'GET /health/ready HTTP/1.1\\r\\nHost: localhost\\r\\nConnection: close\\r\\n\\r\\n' >&3 && grep -q '200 OK' <&3",
				],
				interval: "5s",
				timeout: "5s",
				retries: 60,
				start_period: "10s",
			},
		},
	},
	slots: [
		{
			file: "src/core/auth/users.ts",
			slot: "upsert",
			when: ["drizzle", "postgres"],
			content:
				"await db\n\t.insert(users)\n\t.values(values)\n\t.onConflictDoUpdate({ target: users.id, set: { email: values.email, name: values.name, updatedAt: new Date() } });",
		},
		{
			file: "src/core/auth/users.ts",
			slot: "upsert",
			when: ["drizzle", "mysql"],
			content:
				"await db\n\t.insert(users)\n\t.values(values)\n\t.onDuplicateKeyUpdate({ set: { email: values.email, name: values.name } });",
		},
		{ file: "AGENTS.md", slot: "sections", content: KEYCLOAK_AGENTS },
	],
};
