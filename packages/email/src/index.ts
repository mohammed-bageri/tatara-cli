/** @tatara/email: send through SMTP, or log when the console driver is on. */
import type { CoreLogger } from "@tatara/core";
import { createTransport, type Transporter } from "nodemailer";

export interface EmailMessage {
	to: string;
	subject: string;
	text: string;
	html?: string;
}

export interface MailerOptions {
	driver: "smtp" | "console";
	/** e.g. smtp://localhost:1025 (Mailpit) */
	smtpUrl: string;
	from: string;
	logger: CoreLogger;
}

export interface Mailer {
	send(message: EmailMessage): Promise<void>;
}

export function createMailer(options: MailerOptions): Mailer {
	// created on first send, so building the mailer does no work
	let transport: Transporter | undefined;
	return {
		async send(message) {
			if (options.driver === "console") {
				options.logger.info({ to: message.to, subject: message.subject }, "email (console driver)");
				return;
			}
			transport ??= createTransport(options.smtpUrl);
			await transport.sendMail({ from: options.from, ...message });
		},
	};
}
