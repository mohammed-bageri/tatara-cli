import { authz } from "#core/authz/index";
import { defineSeed } from "@tatara/db";

export default defineSeed({
	name: "authz:system-roles",
	order: -10,
	async run({ logger }) {
		logger.info(await authz.syncSystemRoles(), "built-in roles in sync");
	},
});
