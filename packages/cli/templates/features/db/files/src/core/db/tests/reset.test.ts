import { expect, it } from "vitest";
import { parseFlags } from "@tatara/core";
import reset from "#core/db/commands/reset";

it("does not treat --force false as forcing db:reset", () => {
	expect(reset.args?.parse(parseFlags(["--force", "false"]))).toEqual({ force: false });
});
