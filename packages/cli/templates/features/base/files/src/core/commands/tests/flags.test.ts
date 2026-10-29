import { describe, expect, it } from "vitest";
import { z } from "zod";
import { flag } from "#core/commands/define";
import { parseFlags } from "#core/commands/runner";

const args = z.object({ force: flag() });
const parse = (argv: string[]) => args.parse(parseFlags(argv)).force;

describe("flag()", () => {
	it("is true for a bare flag", () => expect(parse(["--force"])).toBe(true));
	it("reads --flag false as false", () => expect(parse(["--force", "false"])).toBe(false));
	it("reads --flag=0 as false", () => expect(parse(["--force=0"])).toBe(false));
	it("reads --flag true as true", () => expect(parse(["--force", "true"])).toBe(true));
	it("defaults to false", () => expect(parse([])).toBe(false));
	it("rejects anything else", () => expect(() => parse(["--force", "maybe"])).toThrow());
});
