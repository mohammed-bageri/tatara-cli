import { createTransport, type Transporter } from "nodemailer";
import { env } from "#core/config/env";
import { logger } from "#core/logging/logger";

export interface EmailMessage {
	to: string;
	subject: string;
	text: string;
	html?: string;
}

let transport: Transporter | undefined;

/** Sends through SMTP (Mailpit locally) or logs it when EMAIL_DRIVER=console. */
export async function sendEmail(message: EmailMessage): Promise<void> {
	if (env.EMAIL_DRIVER === "console") {
		logger.info({ to: message.to, subject: message.subject }, "email (console driver)");
		return;
	}
	transport ??= createTransport(env.SMTP_URL);
	await transport.sendMail({ from: env.EMAIL_FROM, ...message });
}
