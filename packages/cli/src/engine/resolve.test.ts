import { describe, expect, it } from "vitest";
import type { AppOptions } from "../features/types.ts";
import { OptionsError, selectedFeatureIds, validateOptions } from "./resolve.ts";

const base: AppOptions = {
	name: "my-app",
	orm: "drizzle",
	database: "postgres",
	auth: "better-auth",
	authMethods: ["email-otp"],
	addons: [],
	packageManager: "pnpm",
};

describe("validateOptions", () => {
	it("accepts a valid combination", () => {
		expect(validateOptions(base)).toEqual(base);
	});

	it.each([
		[{ name: "My App" }, /lowercase/],
		[{ orm: "none" as const }, /ORM and a database/],
		[{ orm: "none" as const, database: "none" as const }, /needs a database/],
		[{ authMethods: ["orgs" as const] }, /sign-in method/],
		[{ auth: "none" as const, authMethods: ["password" as const] }, /only apply to better-auth/],
		[
			{ auth: "none" as const, authMethods: [], addons: ["authz" as const] },
			/needs an auth provider/,
		],
		[{ addons: ["admin" as const] }, /"orgs" or "keycloak" method/],
	])("rejects %o", (patch, message) => {
		expect(() => validateOptions({ ...base, ...patch })).toThrow(OptionsError);
		expect(() => validateOptions({ ...base, ...patch })).toThrow(message);
	});

	it("selects shared features alongside the chosen ones", () => {
		expect(
			selectedFeatureIds({ ...base, authMethods: ["email-otp", "orgs"], addons: ["authz"] }),
		).toEqual([
			"base",
			"pm-pnpm",
			"db",
			"postgres",
			"drizzle",
			"better-auth",
			"auth-email-otp",
			"auth-orgs",
			"auth",
			"authz",
		]);
	});
});
