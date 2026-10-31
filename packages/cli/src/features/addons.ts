import type { Feature } from "./types.ts";

const AUTHZ_AGENTS = `## Permissions (authz)

- Permissions are \`resource:action\` (optionally scoped \`own | team | org\`, where a wider scope
  satisfies a narrower one). Each module declares its resources and the grants built-in roles get
  in \`permissions/<name>.permissions.ts\` (\`definePermissions\` from \`@tatara/authz\`); \`tatara sync\` merges them into a
  typed catalog.
- Guard routes with \`middleware: [requirePermission("project:read")]\` from \`#core/authz/index\`
  and declare \`security: [{ bearerAuth: ["project:read"] }]\`. For scoped actions, call
  \`resolveScope(principal, "doc:read")\` in the service and filter rows by the returned scope.
- Effective permissions = role grants (assigned roles + built-in roles whose key matches an
  identity-provider role) + grant overlays − deny overlays. Deny always wins.
- Custom roles and grant overlays can never grant \`role\`, \`member\` or \`audit_log\`.
- Built-in roles live in \`src/core/authz/system-roles.ts\`. Run \`__PM_EXEC__ tatara run authz:sync-permissions\`
  on every deploy (it is idempotent); \`db:seed\` runs it locally.
- In tests: \`asUser({ permissions: ["project:read"] })\` or \`asUser({ systemRoles: ["admin"] })\`.
`;

export const authz: Feature = {
	id: "authz",
	kind: "addon",
	label: "Permission system",
	dependencies: ["@tatara/authz"],
	slots: [
		{
			file: "tests/helpers/auth.ts",
			slot: "imports",
			content: 'import { applyTestAccess, type TestAccess } from "#tests/helpers/authz";',
		},
		{
			file: "tests/helpers/auth.ts",
			slot: "options",
			content: 'permissions?: TestAccess["permissions"];\nsystemRoles?: TestAccess["systemRoles"];',
		},
		{
			file: "tests/helpers/auth.ts",
			slot: "options",
			when: ["better-auth"],
			content: "orgId?: string;",
		},
		{
			file: "tests/helpers/auth.ts",
			slot: "as-user",
			content: "await applyTestAccess(user.userId, options);",
		},
		{ file: "AGENTS.md", slot: "sections", content: AUTHZ_AGENTS },
	],
};

export const jobs: Feature = {
	id: "jobs",
	kind: "addon",
	label: "Jobs + cron (BullMQ)",
	dependencies: ["bullmq", "ioredis", "croner"],
	allowBuilds: ["msgpackr-extract"],
	scripts: {
		"start:worker": "node dist/apps/worker/index.mjs",
		"start:cron": "node dist/apps/cron/index.mjs",
	},
	env: [
		{
			key: "REDIS_PORT",
			schema: "",
			example: "6379",
			composeOnly: true,
			comment: "Host port for local Redis",
		},
		{ key: "REDIS_URL", schema: "z.url()", example: "redis://localhost:6379/0" },
		{
			key: "JOBS_PREFIX",
			schema: 'z.string().default("bull")',
			example: "bull",
			comment: "Redis key prefix for queues",
		},
		{
			key: "WORKER_CONCURRENCY",
			schema: "z.coerce.number().int().positive().default(5)",
			example: "5",
		},
	],
	compose: {
		redis: {
			image: "redis:8-alpine",
			ports: ["${REDIS_PORT:-6379}:6379"],
			healthcheck: {
				test: ["CMD", "redis-cli", "ping"],
				interval: "2s",
				timeout: "3s",
				retries: 30,
			},
		},
	},
	slots: [
		{
			file: "tsdown.config.ts",
			slot: "entries",
			content:
				'"apps/worker/index": "src/apps/worker/index.ts",\n"apps/cron/index": "src/apps/cron/index.ts",',
		},
		{
			file: "tests/setup.ts",
			slot: "setup",
			content: [
				"",
				"// One Redis database per worker.",
				"if (process.env.REDIS_URL) {",
				"\tconst redisUrl = new URL(process.env.REDIS_URL);",
				'\tredisUrl.pathname = `/${process.env.VITEST_POOL_ID ?? "1"}`;',
				"\tprocess.env.REDIS_URL = redisUrl.toString();",
				"}",
			].join("\n"),
		},
		{
			file: "AGENTS.md",
			slot: "sections",
			content: `## Jobs and schedules

- Background work: \`enqueue(topic, payload)\` from \`#core/jobs/queue\`; a module handles it in
  \`consumers/<name>.ts\` (\`defineConsumer({ topic, schema, handle })\`). Payloads are validated by the
  consumer's zod schema. Handlers must be idempotent: jobs retry.
- Recurring work: \`schedules/<name>.ts\` (\`defineSchedule({ name, cron, run })\`). A Redis lock makes
  each tick run once across every cron process.
- Processes: \`apps/worker\` runs consumers, \`apps/cron\` runs schedules. \`dev\` starts both.
`,
		},
	],
};

export const admin: Feature = {
	id: "admin",
	kind: "addon",
	label: "Admin API app",
	scripts: { "start:admin": "node dist/apps/admin/server.mjs" },
	env: [{ key: "ADMIN_PORT", schema: "z.coerce.number().int().default(3001)", example: "3001" }],
	slots: [
		{ file: "src/core/http/routes.ts", slot: "app-names", content: '"admin",' },
		{
			file: "tsdown.config.ts",
			slot: "entries",
			content: '"apps/admin/server": "src/apps/admin/server.ts",',
		},
		{
			file: "src/core/http/app.ts",
			slot: "imports",
			content: 'import { requireRole } from "@tatara/auth";',
		},
		{
			file: "src/core/http/app.ts",
			slot: "routes",
			order: 5,
			content: 'if (name === "admin") app.use(`${API_PREFIX}/*`, requireRole("admin"));',
		},
		{
			file: "tests/helpers/api.ts",
			slot: "imports",
			content: 'import { app as adminApp } from "#apps/admin/app";',
		},
		{
			file: "tests/helpers/api.ts",
			slot: "exports",
			content:
				"\n/** Calls the admin app in-process. */\nexport const adminApi = client(adminApp);",
		},
		{
			file: "AGENTS.md",
			slot: "sections",
			content: `## Admin app

- \`apps/admin\` is a second HTTP app on \`ADMIN_PORT\`. Routes with \`defineRoutes({ app: "admin", … })\`
  are served only there, and every \`/api\` route on it requires the \`admin\` role.
- Test it with \`adminApi\` from \`#tests/helpers/api\`.
`,
		},
	],
};

export const storage: Feature = {
	id: "storage",
	kind: "addon",
	label: "File storage",
	dependencies: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
	env: [
		{
			key: "STORAGE_DRIVER",
			schema: 'localDefault(z.enum(["local", "s3"]), "local")',
			example: "s3",
			test: "local",
		},
		{ key: "STORAGE_LOCAL_DIR", schema: 'z.string().default(".storage")', example: ".storage" },
		{
			key: "S3_ENDPOINT",
			schema: "z.url().optional()",
			example: "http://localhost:9000",
			comment: "Empty for AWS S3",
		},
		{ key: "S3_REGION", schema: 'z.string().default("us-east-1")', example: "us-east-1" },
		{ key: "S3_BUCKET", schema: 'z.string().default("__APP_NAME__")', example: "__APP_NAME__" },
		{ key: "S3_ACCESS_KEY_ID", schema: "z.string().optional()", example: "tatara" },
		{ key: "S3_SECRET_ACCESS_KEY", schema: "z.string().optional()", example: "tatara-secret" },
		{ key: "S3_FORCE_PATH_STYLE", schema: "z.stringbool().default(true)", example: "true" },
		{ key: "STORAGE_PORT", schema: "", example: "9000", composeOnly: true },
		{ key: "STORAGE_CONSOLE_PORT", schema: "", example: "9001", composeOnly: true },
	],
	compose: {
		storage: {
			image: "rustfs/rustfs:1.0.1",
			environment: {
				RUSTFS_ACCESS_KEY: "tatara",
				RUSTFS_SECRET_KEY: "tatara-secret",
				RUSTFS_CONSOLE_ENABLE: "true",
			},
			ports: ["${STORAGE_PORT:-9000}:9000", "${STORAGE_CONSOLE_PORT:-9001}:9001"],
			volumes: ["storage-data:/data"],
			healthcheck: {
				test: ["CMD-SHELL", "curl -fsS http://127.0.0.1:9000/health || exit 1"],
				interval: "2s",
				timeout: "3s",
				retries: 30,
			},
		},
	},
	composeVolumes: ["storage-data"],
	slots: [
		{
			file: "Dockerfile",
			slot: "docker-runtime",
			order: 50,
			// the image runs as node; STORAGE_DRIVER=local writes to STORAGE_LOCAL_DIR (.storage)
			content: "RUN mkdir -p .storage && chown node:node .storage",
		},
		{ file: ".gitignore", slot: "ignore", content: ".storage/" },
		{
			file: "AGENTS.md",
			slot: "sections",
			content: `## Storage

- Use \`storage\` from \`#core/storage/index\` (\`put\`, \`get\`, \`delete\`, \`url\`). \`STORAGE_DRIVER=s3\` works with
  any S3-compatible store (RustFS locally, AWS S3, R2); \`local\` writes to \`STORAGE_LOCAL_DIR\` (tests).
- \`tatara run storage:check\` creates the bucket and does a round-trip.
`,
		},
	],
};

export const email: Feature = {
	id: "email",
	kind: "addon",
	label: "Email",
	dependencies: ["nodemailer"],
	devDependencies: ["@types/nodemailer"],
	env: [
		{
			key: "EMAIL_DRIVER",
			schema: 'localDefault(z.enum(["smtp", "console"]), "console")',
			example: "smtp",
			test: "console",
		},
		{
			key: "SMTP_URL",
			schema: 'localDefault(z.string(), "smtp://localhost:1025")',
			example: "smtp://localhost:1025",
		},
		{
			key: "EMAIL_FROM",
			schema: 'z.string().default("__APP_NAME__ <no-reply@example.com>")',
			example: "__APP_NAME__ <no-reply@example.com>",
		},
		{ key: "MAILPIT_SMTP_PORT", schema: "", example: "1025", composeOnly: true },
		{ key: "MAILPIT_UI_PORT", schema: "", example: "8025", composeOnly: true },
	],
	compose: {
		mailpit: {
			image: "axllent/mailpit:v1.31",
			ports: ["${MAILPIT_SMTP_PORT:-1025}:1025", "${MAILPIT_UI_PORT:-8025}:8025"],
			healthcheck: {
				test: ["CMD", "/mailpit", "readyz"],
				interval: "2s",
				timeout: "3s",
				retries: 30,
			},
		},
	},
	slots: [
		{
			file: "AGENTS.md",
			slot: "sections",
			content: `## Email

- \`sendEmail({ to, subject, text, html? })\` from \`#core/email/send\`. Locally it goes to Mailpit
  (UI on \`MAILPIT_UI_PORT\`); tests use the console driver.
`,
		},
	],
};

export const i18n: Feature = {
	id: "i18n",
	kind: "addon",
	label: "i18n",
	env: [{ key: "DEFAULT_LANGUAGE", schema: 'z.enum(["en", "ar"]).default("en")', example: "en" }],
	slots: [
		{
			file: "src/core/http/app.ts",
			slot: "imports",
			content: 'import { detectLanguage } from "#core/i18n/index";',
		},
		{
			file: "src/core/http/app.ts",
			slot: "middleware",
			order: 10,
			content: "app.use(detectLanguage);",
		},
		{
			file: "src/core/http/app.ts",
			slot: "imports",
			content: 'import { t } from "#core/i18n/index";',
		},
		{
			file: "src/core/http/app.ts",
			slot: "error-options",
			content: [
				"message: (err, c) =>",
				'\terr.translatable ? t(c.get("language"), `errors.${err.code}`, err.message) : err.message,',
			].join("\n"),
		},
		{
			file: "AGENTS.md",
			slot: "sections",
			content: `## i18n

- Language comes from \`?lang\`, the \`lang\` cookie, then \`Accept-Language\` (\`c.var.language\`).
- Strings live in \`src/locales/<lang>.json\`; use \`t(language, "errors.NOT_FOUND")\`. Error responses are
  translated by code (\`errors.<CODE>\`), so add a key when you add an error code.
`,
		},
	],
};
