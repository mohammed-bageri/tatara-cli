import { describe, expect, it } from "vitest";
import { importsOf } from "./imports.ts";

describe("importsOf", () => {
	it.each([
		['import { a, type B, c as d } from "#x";', ["a", "B", "c"]],
		['import type { A } from "#x";', ["A"]],
		['export { a } from "#x";', ["a"]],
		['import * as all from "#x";', ["*"]],
		['import thing from "#x";', ["*"]],
		['import "#x";', ["*"]],
		['const m = await import("#x");', ["*"]],
		['import { a } from "#x/sub";', null],
		['import { a } from "#y";', null],
	])("%s", (text, expected) => {
		expect(importsOf(text, "#x")).toEqual(expected);
	});

	it("reads imports split over lines", () => {
		expect(importsOf('import {\n\ta,\n\tb,\n} from "#x";', "#x")).toEqual(["a", "b"]);
	});
});
