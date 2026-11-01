import type { Codemod } from "../codemods.ts";

const NOTIFIER = "src/modules/notifications/services/notifier.ts";
const TEST = "src/modules/notifications/tests/role-recipients.test.ts";

/** `recipients.role` reads authz roles: better-auth's member role is only owner or member. */
export const notifierRoles: Codemod = {
	version: "0.13.1",
	id: "notifier-roles",
	description: "Notifying by role reaches holders of the authz role",
	async run(ctx) {
		const { config } = ctx.project;
		const addons = config.addons as string[];
		if (!addons.includes("notifications") || !addons.includes("authz")) return;
		if (!config.authMethods.includes("orgs")) return;
		const text = await ctx.read(NOTIFIER).catch(() => undefined);
		if (text === undefined) return;
		if (await ctx.baseline.isUnchanged(NOTIFIER, text)) await ctx.regenerate(NOTIFIER);
		else
			ctx.report.notes.push(
				`In ${NOTIFIER}, recipients.role should check authz roles: \`(await authz.effectivePermissions(who)).roles.includes(role)\` for each member, with who as in recipients.permission. Matching member.role finds nobody now that it is only owner or member.`,
			);
		if ((await ctx.read(TEST).catch(() => undefined)) === undefined) {
			const test = await ctx.renderCurrent(TEST);
			if (test !== undefined) await ctx.write(TEST, test);
		}
	},
};
