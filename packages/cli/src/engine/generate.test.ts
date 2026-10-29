import { describe, expect, it } from "vitest";
import type { Addon, AppOptions, AuthMethod } from "../features/types.ts";
import { renderApp } from "./generate.ts";
import { validateOptions } from "./resolve.ts";
import { hasSlots } from "./slots.ts";

const ADDONS: Addon[] = ["authz", "jobs", "admin", "storage", "email", "i18n"];
const METHODS: AuthMethod[] = ["email-otp", "phone-otp", "password", "orgs"];

function combinations(): AppOptions[] {
	const out: AppOptions[] = [];
	for (const pm of ["pnpm", "npm", "bun"] as const) {
		out.push({
			name: "plain",
			orm: "none",
			database: "none",
			auth: "none",
			authMethods: [],
			addons: ["jobs", "email", "i18n", "storage"],
			packageManager: pm,
		});
		for (const orm of ["drizzle", "prisma"] as const) {
			for (const database of ["postgres", "mysql"] as const) {
				out.push({
					name: "app",
					orm,
					database,
					auth: "none",
					authMethods: [],
					addons: [],
					packageManager: pm,
				});
				out.push({
					name: "app",
					orm,
					database,
					auth: "better-auth",
					authMethods: ["keycloak"],
					addons: ADDONS,
					packageManager: pm,
				});
				out.push({
					name: "app",
					orm,
					database,
					auth: "better-auth",
					authMethods: METHODS,
					addons: ADDONS,
					packageManager: pm,
				});
				out.push({
					name: "app",
					orm,
					database,
					auth: "better-auth",
					authMethods: ["password"],
					addons: ["authz"],
					packageManager: pm,
				});
			}
		}
	}
	return out.map(validateOptions);
}

const TOKENS = /__(APP_NAME|APP_DB|PM_RUN|PM_EXEC|BIOME_VERSION)__|__(name|module)[A-Z]\w*__/;

describe("renderApp", () => {
	it.each(
		combinations().map((o) => [
			`${o.orm}/${o.database}/${o.auth}/${o.addons.length}/${o.packageManager}`,
			o,
		]),
	)("%s leaves no tokens or markers behind", async (_label, options) => {
		const files = await renderApp(options as AppOptions);
		for (const [path, text] of files) {
			expect(TOKENS.test(text), `${path} has an unreplaced token`).toBe(false);
			expect(hasSlots(text), `${path} has an unfilled slot marker`).toBe(false);
		}
		const pkg = JSON.parse(files.get("package.json") ?? "{}") as {
			dependencies: Record<string, string>;
		};
		expect(Object.values(pkg.dependencies).every((v) => /^\d/.test(v))).toBe(true);
	});

	it("produces the expected file set for a full better-auth app", async () => {
		const files = await renderApp(
			validateOptions({
				name: "app",
				orm: "drizzle",
				database: "postgres",
				auth: "better-auth",
				authMethods: METHODS,
				addons: ADDONS,
				packageManager: "pnpm",
			}),
		);
		expect([...files.keys()].sort()).toMatchSnapshot();
	});

	it("produces the expected file set for a minimal app", async () => {
		const files = await renderApp(
			validateOptions({
				name: "app",
				orm: "none",
				database: "none",
				auth: "none",
				authMethods: [],
				addons: [],
				packageManager: "npm",
			}),
		);
		expect([...files.keys()].sort()).toMatchSnapshot();
	});

	it("only includes compose services the options need", async () => {
		const files = await renderApp(
			validateOptions({
				name: "app",
				orm: "prisma",
				database: "mysql",
				auth: "better-auth",
				authMethods: ["keycloak"],
				addons: ["jobs"],
				packageManager: "pnpm",
			}),
		);
		const compose = files.get("compose.yaml") ?? "";
		expect(compose).toContain("mysql:");
		expect(compose).toContain("keycloak:");
		expect(compose).toContain("redis:");
		expect(compose).not.toContain("postgres:");
		expect(compose).not.toContain("mailpit:");
	});
});
