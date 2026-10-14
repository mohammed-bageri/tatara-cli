import { defineCommand } from "#core/commands/define";
import { seeds } from "#generated/seeds";

export default defineCommand({
	name: "db:seed",
	description: "Run every idempotent seed (core first, then modules)",
	async run(_args, { logger }) {
		for (const seed of [...seeds].sort((a, b) => (a.order ?? 100) - (b.order ?? 100))) {
			await seed.run({ logger: logger.child({ seed: seed.name }) });
			logger.info({ seed: seed.name }, "seeded");
		}
	},
});
