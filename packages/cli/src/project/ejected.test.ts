import { describe, expect, it } from "vitest";
import { pointAtEjected } from "./ejected.ts";

describe("pointAtEjected", () => {
	it("rewrites the package and its entries, and nothing else", () => {
		const text = [
			'import { requireAuth } from "@tatara/auth";',
			"import { createTestUser } from '@tatara/auth/testing';",
			'import { createAuthz } from "@tatara/authz";',
			'import { createApp } from "@tatara/http";',
		].join("\n");
		expect(pointAtEjected(text, ["auth"]).split("\n")).toEqual([
			'import { requireAuth } from "#ejected/auth/index";',
			"import { createTestUser } from '#ejected/auth/testing';",
			'import { createAuthz } from "@tatara/authz";',
			'import { createApp } from "@tatara/http";',
		]);
	});

	it("leaves text alone when nothing is ejected", () => {
		expect(pointAtEjected('from "@tatara/auth"', [])).toBe('from "@tatara/auth"');
	});
});
