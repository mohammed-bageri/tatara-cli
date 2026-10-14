import { describe, expect, it } from "vitest";
import { applyNames, names, pluralize } from "./names.ts";

describe("names", () => {
	it("derives every case from any input style", () => {
		for (const input of [
			"billing-account",
			"BillingAccount",
			"billing_account",
			"billing account",
		]) {
			expect(names(input)).toMatchObject({
				kebab: "billing-account",
				pascal: "BillingAccount",
				camel: "billingAccount",
				snake: "billing_account",
				pluralKebab: "billing-accounts",
				pluralSnake: "billing_accounts",
				title: "Billing account",
			});
		}
	});

	it("pluralizes common English forms", () => {
		expect(["box", "category", "person", "status", "leaf", "data", "key"].map(pluralize)).toEqual([
			"boxes",
			"categories",
			"people",
			"statuses",
			"leaves",
			"data",
			"keys",
		]);
	});

	it("rejects names that do not start with a letter", () => {
		expect(() => names("1st")).toThrow();
		expect(() => names("---")).toThrow();
	});

	it("replaces prefixed tokens, plural forms first", () => {
		const n = names("line-item");
		expect(applyNames("__namePluralCamel__ __nameCamel__ __nameKebab__", "name", n)).toBe(
			"lineItems lineItem line-item",
		);
	});
});
