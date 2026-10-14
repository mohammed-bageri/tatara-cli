import { describe, expect, it } from "vitest";
import { fillSlots, hasSlots } from "./slots.ts";

describe("slots", () => {
	it("replaces markers with indented contributions in order and drops empty markers", () => {
		const text = "a\n\t// tatara:slot body\n# tatara:slot other\nb";
		const out = fillSlots(text, [
			{ slot: "body", content: "second();", order: 2 },
			{ slot: "body", content: "first();\nalso();", order: 1 },
		]);
		expect(out).toBe("a\n\tfirst();\n\talso();\n\tsecond();\nb");
		expect(hasSlots(out)).toBe(false);
	});

	it("inserts identical contributions once", () => {
		const out = fillSlots("// tatara:slot imports", [
			{ slot: "imports", content: 'import { x } from "y";', order: 1 },
			{ slot: "imports", content: 'import { x } from "y";', order: 2 },
		]);
		expect(out).toBe('import { x } from "y";');
	});

	it("supports markdown markers", () => {
		expect(
			fillSlots("<!-- tatara:slot sections -->", [{ slot: "sections", content: "## A", order: 1 }]),
		).toBe("## A");
	});
});
