import { defineCommand } from "@tatara/core";
import { authz } from "#core/authz/index";

export default defineCommand({
	name: "authz:sync-permissions",
	description: "Create/update built-in roles so their grants match the code (run on every deploy)",
	async run(_args, { logger }) {
		const result = await authz.syncSystemRoles();
		logger.info(result, "built-in roles in sync");
	},
});
