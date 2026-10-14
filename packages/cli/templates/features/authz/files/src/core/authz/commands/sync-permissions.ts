import { defineCommand } from "#core/commands/define";
import { syncSystemRoles } from "#core/authz/services/sync";

export default defineCommand({
	name: "authz:sync-permissions",
	description: "Create/update built-in roles so their grants match the code (run on every deploy)",
	async run(_args, { logger }) {
		const result = await syncSystemRoles();
		logger.info(result, "built-in roles in sync");
	},
});
