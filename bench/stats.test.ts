import { describe, expect, it } from "vitest";
import { median } from "./stats.ts";

describe("median", () => {
	it("reports the median of runs", () => expect(median([5, 1, 100, 3, 4])).toBe(4));
	it("uses the mean of the middle two for an even count", () =>
		expect(median([1, 2, 3, 10])).toBe(2.5));
	it("rejects an empty list", () => expect(() => median([])).toThrow());
});
