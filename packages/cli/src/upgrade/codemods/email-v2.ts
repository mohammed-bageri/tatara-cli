import type { Codemod } from "../codemods.ts";

const FILES = ["src/core/email/send.ts", "src/core/config/env.ts", ".env.example", ".env.test"];

/** Mailgun and email templates (`emails/*.ts`, `sendTemplate`) in apps with the email add-on. */
export const emailV2: Codemod = {
	version: "0.11.0",
	id: "email-v2",
	description: "Email: a Mailgun driver and templates (emails/*.ts, sendTemplate)",
	async run(ctx) {
		if (!ctx.project.config.addons.includes("email")) return;
		const customised: string[] = [];
		for (const path of FILES) {
			const text = await ctx.read(path).catch(() => undefined);
			if (text === undefined) continue;
			if (await ctx.baseline.isUnchanged(path, text)) await ctx.regenerate(path);
			else customised.push(path);
		}
		if (customised.length > 0)
			ctx.report.notes.push(
				`Compare ${customised.join(", ")} with a newly generated app: EMAIL_DRIVER may be "mailgun" (MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_API_URL), and src/core/email/send.ts exports sendTemplate for emails/*.ts templates.`,
			);
	},
};
