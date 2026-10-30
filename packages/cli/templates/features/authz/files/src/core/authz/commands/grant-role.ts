import { z } from "zod";
import { DEFAULT_ORG_ID, SYSTEM_ORG_ID } from "#core/authz/constants";
import { store } from "#core/authz/db/store";
import { assignRole } from "#core/authz/services/members";
import { defineCommand } from "@tatara/core";

export default defineCommand({
	name: "authz:grant-role",
	description: "Assign a role (built-in key or custom role key) to a user in an org",
	args: z.object({
		user: z.string().min(1),
		role: z.string().min(1),
		org: z.string().default(DEFAULT_ORG_ID),
	}),
	async run({ user, role, org }, { logger }) {
		const found = (await store.findRoleByKey(org, role)) ?? (await store.findRoleByKey(SYSTEM_ORG_ID, role));
		if (!found) throw new Error(`No role "${role}" (run authz:sync-permissions first for built-in roles)`);
		const added = await assignRole(null, org, user, found.id);
		logger.info({ user, role, org, added }, added ? "role assigned" : "role already assigned");
	},
});
