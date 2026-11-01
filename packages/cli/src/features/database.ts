import type { Feature } from "./types.ts";

const AGENTS_DB = `## Database

- Tables live in \`src/<core|modules>/<area>/db/<name>.schema.ts\` (Drizzle) or
  \`prisma/models/<name>.prisma\` (Prisma), one file per table. \`tatara make schema\` creates one.
- Services take an \`Executor\` (\`db\` or a transaction) as their first argument when they
  write, so callers can run several services in one transaction.
- Change the schema, then generate a migration: \`__PM_EXEC__ tatara db generate --name <change>\`.
  Never edit an applied migration; add a new one.
- Seeds (\`db/seed.ts\`, \`defineSeed\`) must be idempotent: they run on every \`dev\`.
- Integration tests run against a real database (one per worker). Call \`resetDatabase()\`
  from \`#tests/helpers/db\` in \`beforeEach\`.
`;

export const db: Feature = {
	id: "db",
	kind: "database",
	label: "Database (shared)",
	dependencies: ["@tatara/db"],
	scripts: {
		"db:generate": "tatara db generate",
		"db:migrate": "tatara db migrate",
		"db:seed": "tatara db seed",
		"db:reset": "tatara db reset",
		"db:studio": "tatara db studio",
	},
	env: [
		{
			key: "DATABASE_POOL_MAX",
			schema: "z.coerce.number().int().positive().default(10)",
			example: "10",
		},
	],
	slots: [
		{
			file: "vitest.config.ts",
			slot: "vitest",
			content: 'globalSetup: ["tests/global-setup.ts"],\nmaxWorkers: 4,\nfileParallelism: true,',
		},
		{
			file: "tests/setup.ts",
			slot: "setup",
			content: [
				'import { workerDatabaseUrl } from "@tatara/testing";',
				"",
				"// One database per worker, created by tests/global-setup.ts.",
				'process.env.DATABASE_URL = workerDatabaseUrl(process.env.DATABASE_URL ?? "", process.env.VITEST_POOL_ID ?? "1");',
			].join("\n"),
		},
		{
			file: "src/apps/cli/index.ts",
			slot: "imports",
			content:
				'import { env } from "#core/config/env";\nimport { commandLedger } from "#core/db/admin";',
		},
		{
			// `deploy` remembers the "once" commands it ran, per database
			file: "src/apps/cli/index.ts",
			slot: "options",
			content: "ledger: commandLedger(env.DATABASE_URL),",
		},
		{ file: "AGENTS.md", slot: "sections", content: AGENTS_DB },
	],
};

export const postgres: Feature = {
	id: "postgres",
	kind: "database",
	label: "PostgreSQL",
	dependencies: ["pg"],
	devDependencies: ["@types/pg"],
	env: [
		{
			key: "DB_PORT",
			schema: "",
			example: "5432",
			composeOnly: true,
			comment: "Host port for the local database container (keep DATABASE_URL in sync)",
		},
		{
			key: "DATABASE_URL",
			schema: "z.url()",
			example: "postgres://postgres:postgres@localhost:5432/__APP_DB__",
			test: "postgres://postgres:postgres@localhost:5432/__APP_DB___test",
		},
	],
	compose: {
		postgres: {
			image: "postgres:18-alpine",
			environment: {
				POSTGRES_USER: "postgres",
				POSTGRES_PASSWORD: "postgres",
				POSTGRES_DB: "__APP_DB__",
			},
			ports: ["${DB_PORT:-5432}:5432"],
			volumes: ["postgres-data:/var/lib/postgresql"],
			healthcheck: {
				test: ["CMD-SHELL", "pg_isready -U postgres"],
				interval: "2s",
				timeout: "3s",
				retries: 30,
			},
		},
	},
	composeVolumes: ["postgres-data"],
};

export const mysql: Feature = {
	id: "mysql",
	kind: "database",
	label: "MySQL",
	variants: [
		{ when: ["drizzle"], dependencies: ["mysql2"] },
		{ when: ["prisma"], dependencies: ["mariadb"] },
	],
	env: [
		{
			key: "DB_PORT",
			schema: "",
			example: "3306",
			composeOnly: true,
			comment: "Host port for the local database container (keep DATABASE_URL in sync)",
		},
		{
			key: "DATABASE_URL",
			schema: "z.url()",
			example: "mysql://root:root@localhost:3306/__APP_DB__",
			test: "mysql://root:root@localhost:3306/__APP_DB___test",
		},
	],
	compose: {
		mysql: {
			image: "mysql:9.7",
			environment: { MYSQL_ROOT_PASSWORD: "root", MYSQL_DATABASE: "__APP_DB__" },
			ports: ["${DB_PORT:-3306}:3306"],
			volumes: ["mysql-data:/var/lib/mysql"],
			healthcheck: {
				test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -proot --silent"],
				interval: "2s",
				timeout: "3s",
				retries: 60,
			},
		},
	},
	composeVolumes: ["mysql-data"],
};

export const drizzle: Feature = {
	id: "drizzle",
	kind: "orm",
	label: "Drizzle",
	dependencies: ["drizzle-orm"],
	devDependencies: ["drizzle-kit"],
	allowBuilds: ["esbuild"],
	slots: [
		{
			file: "Dockerfile",
			slot: "docker-runtime",
			order: 10,
			content: "COPY --from=build /app/drizzle ./drizzle",
		},
	],
};

export const prisma: Feature = {
	id: "prisma",
	kind: "orm",
	label: "Prisma",
	// prisma is a runtime dependency: `db:migrate` runs `prisma migrate deploy` in production
	dependencies: ["@prisma/client", "prisma"],
	allowBuilds: ["prisma", "@prisma/engines", "esbuild"],
	variants: [
		{ when: ["postgres"], dependencies: ["@prisma/adapter-pg"] },
		{ when: ["mysql"], dependencies: ["@prisma/adapter-mariadb"] },
	],
	slots: [
		{
			file: "Dockerfile",
			slot: "docker-runtime",
			order: 10,
			content: "COPY --from=build /app/prisma ./prisma\nCOPY --from=build /app/prisma.config.ts ./",
		},
	],
};
