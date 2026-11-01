import type { Feature } from "./types.ts";

export const base: Feature = {
	id: "base",
	kind: "base",
	label: "Hono API",
	dependencies: [
		"@tatara/core",
		"@tatara/http",
		"hono",
		"@hono/node-server",
		"@hono/zod-openapi",
		"@scalar/hono-api-reference",
		"zod",
		"@t3-oss/env-core",
		"pino",
	],
	devDependencies: [
		"@tatara/testing",
		"@tatara/cli",
		"typescript",
		"@types/node",
		"vitest",
		"tsdown",
		"@biomejs/biome",
		"pino-pretty",
	],
	scripts: {
		dev: "tatara dev",
		"dev:down": "tatara dev --down",
		"dev:reset": "tatara dev --reset",
		build: "tatara sync && tsdown",
		start: "node dist/apps/api/server.mjs",
		lint: "biome check . && tatara check",
		format: "biome check --write .",
		typecheck: "tatara sync && tsc",
		test: "tatara sync && vitest run",
		"test:watch": "tatara sync && vitest",
		verify: "tatara verify",
	},
	env: [
		{
			key: "NODE_ENV",
			// required on purpose: a missing NODE_ENV must not silently mean "development"
			schema: 'z.enum(["development", "test", "production"])',
			example: "development",
			test: "test",
		},
		{ key: "PORT", schema: "z.coerce.number().int().default(3000)", example: "3000" },
		{
			key: "LOG_LEVEL",
			schema:
				'z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info")',
			example: "info",
			test: "silent",
		},
		{
			key: "APP_URL",
			schema: 'localDefault(z.url(), "http://localhost:3000")',
			example: "http://localhost:3000",
			comment: "Public URL of the API",
		},
		{
			key: "CORS_ORIGINS",
			schema:
				'localDefault(z.string(), "http://localhost:5173").transform((v) => v.split(",").map((o) => o.trim()).filter(Boolean))',
			example: "http://localhost:5173",
			comment: "Comma-separated browser origins allowed to call the API",
		},
		{
			key: "BODY_LIMIT_BYTES",
			schema: "z.coerce.number().int().positive().default(1_048_576)",
			example: "1048576",
		},
		{
			key: "REQUEST_TIMEOUT_MS",
			schema: "z.coerce.number().int().positive().default(30_000)",
			example: "30000",
			comment:
				"Longest a request may take before a 504 (slow paths get their own in src/apps/http.ts)",
		},
		{
			key: "TRUSTED_PROXY_HOPS",
			schema: "z.coerce.number().int().min(0).default(0)",
			example: "0",
			comment:
				"Proxies in front of the app that append to X-Forwarded-For (a load balancer, Cloud Run: 1)",
		},
	],
	entrypoints: [
		{ name: "api", file: "server.ts", description: "HTTP API" },
		{ name: "cli", file: "index.ts", description: "App commands" },
	],
};

export const pnpm: Feature = {
	id: "pm-pnpm",
	kind: "base",
	label: "pnpm",
	slots: [
		{ file: "Dockerfile", slot: "docker-base", content: "RUN corepack enable" },
		{
			file: "Dockerfile",
			slot: "docker-build",
			content: [
				"COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./",
				"RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store --mount=type=cache,id=pnpm-cache,target=/root/.cache/pnpm pnpm install --frozen-lockfile",
				"COPY . .",
				"RUN pnpm run build",
			].join("\n"),
		},
		{
			file: "Dockerfile",
			slot: "docker-runtime",
			order: 0,
			content: [
				"COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./",
				"# cache mounts keep the package store out of the image",
				"RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store --mount=type=cache,id=pnpm-cache,target=/root/.cache/pnpm pnpm install --frozen-lockfile --prod",
				"COPY --from=build /app/dist ./dist",
			].join("\n"),
		},
		{
			file: ".github/workflows/ci.yml",
			slot: "ci-setup",
			content: [
				"- uses: pnpm/action-setup@v4",
				"- uses: actions/setup-node@v5",
				"  with:",
				"    node-version: 24",
				"    cache: pnpm",
				"- run: pnpm install --frozen-lockfile",
			].join("\n"),
		},
	],
};

export const npm: Feature = {
	id: "pm-npm",
	kind: "base",
	label: "npm",
	slots: [
		{
			file: "Dockerfile",
			slot: "docker-build",
			content: [
				"COPY package.json package-lock.json ./",
				"RUN --mount=type=cache,target=/root/.npm npm ci",
				"COPY . .",
				"RUN npm run build",
			].join("\n"),
		},
		{
			file: "Dockerfile",
			slot: "docker-runtime",
			order: 0,
			content: [
				"COPY package.json package-lock.json ./",
				"RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev",
				"COPY --from=build /app/dist ./dist",
			].join("\n"),
		},
		{
			file: ".github/workflows/ci.yml",
			slot: "ci-setup",
			content: [
				"- uses: actions/setup-node@v5",
				"  with:",
				"    node-version: 24",
				"    cache: npm",
				"- run: npm ci",
			].join("\n"),
		},
	],
};

export const bun: Feature = {
	id: "pm-bun",
	kind: "base",
	label: "bun",
	slots: [
		{ file: "Dockerfile", slot: "docker-base", content: "RUN npm install --global bun" },
		{
			file: "Dockerfile",
			slot: "docker-build",
			content: [
				"COPY package.json bun.lock ./",
				"RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile",
				"COPY . .",
				"RUN bun run build",
			].join("\n"),
		},
		{
			file: "Dockerfile",
			slot: "docker-runtime",
			order: 0,
			content: [
				"COPY package.json bun.lock ./",
				"RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --production",
				"COPY --from=build /app/dist ./dist",
			].join("\n"),
		},
		{
			file: ".github/workflows/ci.yml",
			slot: "ci-setup",
			content: [
				"- uses: oven-sh/setup-bun@v2",
				"- uses: actions/setup-node@v5",
				"  with:",
				"    node-version: 24",
				"- run: bun install --frozen-lockfile",
			].join("\n"),
		},
	],
};
