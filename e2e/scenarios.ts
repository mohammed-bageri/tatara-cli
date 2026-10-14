export interface Scenario {
	name: string;
	orm: "drizzle" | "prisma" | "none";
	database: "postgres" | "mysql" | "none";
	auth: "better-auth" | "keycloak" | "none";
	authMethods?: ("email-otp" | "phone-otp" | "password" | "orgs")[];
	addons: ("authz" | "jobs" | "admin" | "storage" | "email" | "i18n")[];
	pm: "pnpm" | "npm" | "bun";
	flags: string[];
}

function scenario(name: string, s: Omit<Scenario, "name" | "flags">): Scenario {
	const flags = [
		"--orm",
		s.orm,
		"--db",
		s.database,
		"--auth",
		s.auth,
		...(s.authMethods?.length ? ["--auth-methods", s.authMethods.join(",")] : []),
		"--addons",
		s.addons.length ? s.addons.join(",") : "none",
		"--pm",
		s.pm,
	];
	return { name, ...s, flags };
}

const ALL_ADDONS = ["authz", "jobs", "admin", "storage", "email", "i18n"] as const;
const NO_AUTH_ADDONS = ["jobs", "storage", "email", "i18n"] as const;
const ALL_METHODS = ["email-otp", "phone-otp", "password", "orgs"] as const;

const core: Scenario[] = [];
for (const orm of ["drizzle", "prisma"] as const) {
	for (const database of ["postgres", "mysql"] as const) {
		const short = `${orm === "drizzle" ? "dz" : "pr"}-${database === "postgres" ? "pg" : "my"}`;
		core.push(
			scenario(`${short}-better-auth-full`, {
				orm,
				database,
				auth: "better-auth",
				authMethods: [...ALL_METHODS],
				addons: [...ALL_ADDONS],
				pm: "pnpm",
			}),
			scenario(`${short}-keycloak-full`, {
				orm,
				database,
				auth: "keycloak",
				addons: [...ALL_ADDONS],
				pm: "pnpm",
			}),
			scenario(`${short}-no-auth-full`, {
				orm,
				database,
				auth: "none",
				addons: [...NO_AUTH_ADDONS],
				pm: "pnpm",
			}),
			scenario(`${short}-minimal`, { orm, database, auth: "none", addons: [], pm: "pnpm" }),
		);
	}
}

export const SCENARIOS: Scenario[] = [
	scenario("no-db-minimal", {
		orm: "none",
		database: "none",
		auth: "none",
		addons: [],
		pm: "pnpm",
	}),
	scenario("no-db-addons", {
		orm: "none",
		database: "none",
		auth: "none",
		addons: ["jobs", "email", "i18n"],
		pm: "pnpm",
	}),
	...core,
	scenario("ba-password-authz", {
		orm: "drizzle",
		database: "postgres",
		auth: "better-auth",
		authMethods: ["password"],
		addons: ["authz"],
		pm: "pnpm",
	}),
	scenario("ba-phone-only", {
		orm: "prisma",
		database: "mysql",
		auth: "better-auth",
		authMethods: ["phone-otp"],
		addons: [],
		pm: "pnpm",
	}),
	scenario("npm-prisma-pg-minimal", {
		orm: "prisma",
		database: "postgres",
		auth: "none",
		addons: [],
		pm: "npm",
	}),
	scenario("npm-dz-my-better-auth", {
		orm: "drizzle",
		database: "mysql",
		auth: "better-auth",
		authMethods: ["email-otp"],
		addons: ["i18n"],
		pm: "npm",
	}),
	scenario("bun-no-db-minimal", {
		orm: "none",
		database: "none",
		auth: "none",
		addons: [],
		pm: "bun",
	}),
	scenario("bun-dz-pg-keycloak", {
		orm: "drizzle",
		database: "postgres",
		auth: "keycloak",
		addons: ["authz"],
		pm: "bun",
	}),
];
