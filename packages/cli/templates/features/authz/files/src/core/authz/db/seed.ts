import { syncSystemRoles } from "#core/authz/services/sync";
import { defineSeed } from "#core/db/seed";

export default defineSeed({
	name: "authz:system-roles",
	order: -10,
	async run({ logger }) {
		logger.info(await syncSystemRoles(), "built-in roles in sync");
	},
});
