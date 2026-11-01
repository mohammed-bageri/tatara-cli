import { createMailer, type EmailDefinition, renderEmail } from "@tatara/email";
import { env } from "#core/config/env";
import { logger } from "#core/logging/logger";
import type { emails } from "#generated/emails";

export type { EmailMessage } from "@tatara/email";

/** Sends through SMTP (Mailpit locally) or Mailgun, or logs it when EMAIL_DRIVER=console. */
export const { send: sendEmail } = createMailer({
	driver: env.EMAIL_DRIVER,
	smtpUrl: env.SMTP_URL,
	...(env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN
		? { mailgun: { apiKey: env.MAILGUN_API_KEY, domain: env.MAILGUN_DOMAIN, apiUrl: env.MAILGUN_API_URL } }
		: {}),
	from: env.EMAIL_FROM,
	logger,
});

type Templates = { [E in (typeof emails)[number] as E["name"]]: Parameters<E["render"]>[0] };

/** Renders an `emails/*.ts` template in `language` and sends it. */
export async function sendTemplate<N extends keyof Templates & string>(
	name: N,
	to: string,
	data: Templates[N],
	language = "en",
): Promise<void> {
	// loaded on first use: core doesn't import module code until it's needed
	const { emails: all } = await import("#generated/emails");
	// read as any template: an app without templates has an empty list
	const template = (all as readonly EmailDefinition[]).find((e) => e.name === name);
	if (!template) throw new Error(`No email template named "${name}"`);
	await sendEmail({ to, ...renderEmail(template, data, language) });
}
