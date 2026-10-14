import { z } from "zod";
import { defineCommand } from "#core/commands/define";

export default defineCommand({
	name: "__moduleKebab__:__nameKebab__",
	description: "__nameTitle__",
	args: z.object({ dryRun: z.coerce.boolean().default(false) }),
	async run({ dryRun }, { logger }) {
		logger.info({ dryRun }, "__moduleKebab__:__nameKebab__ ran");
	},
});
