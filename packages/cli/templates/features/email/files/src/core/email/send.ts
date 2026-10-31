import { createMailer } from "@tatara/email";
import { env } from "#core/config/env";
import { logger } from "#core/logging/logger";

export type { EmailMessage } from "@tatara/email";

/** Sends through SMTP (Mailpit locally) or logs it when EMAIL_DRIVER=console. */
export const { send: sendEmail } = createMailer({
	driver: env.EMAIL_DRIVER,
	smtpUrl: env.SMTP_URL,
	from: env.EMAIL_FROM,
	logger,
});
