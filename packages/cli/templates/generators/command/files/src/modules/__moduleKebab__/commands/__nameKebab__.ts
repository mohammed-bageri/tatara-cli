import { z } from "zod";
import { defineCommand, flag } from "@tatara/core";

export default defineCommand({
	name: "__moduleKebab__:__nameKebab__",
	description: "__nameTitle__",
	args: z.object({ dryRun: flag() }),
	async run({ dryRun }, { logger }) {
		logger.info({ dryRun }, "__moduleKebab__:__nameKebab__ ran");
	},
});
