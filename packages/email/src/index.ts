/** @tatara/email: send through SMTP or Mailgun, or log with the console driver; typed templates. */
import type { CoreLogger } from "@tatara/core";
import { createTransport, type Transporter } from "nodemailer";

export { defineEmail, type EmailDefinition, type RenderedEmail, renderEmail } from "./templates.ts";

export interface EmailMessage {
	to: string | string[];
	subject: string;
	text: string;
	html?: string;
	replyTo?: string;
}

export interface MailerOptions {
	driver: "smtp" | "mailgun" | "console";
	/** e.g. smtp://localhost:1025 (Mailpit); for the smtp driver */
	smtpUrl?: string;
	/** for the mailgun driver; `apiUrl` is https://api.eu.mailgun.net for EU domains */
	mailgun?: { apiKey: string; domain: string; apiUrl?: string };
	from: string;
	logger: CoreLogger;
	/** for tests: the HTTP client the mailgun driver uses */
	fetch?: typeof fetch;
}

export interface Mailer {
	send(message: EmailMessage): Promise<void>;
}

const list = (to: string | string[]) => (Array.isArray(to) ? to : [to]);

export function createMailer(options: MailerOptions): Mailer {
	// created on first send, so building the mailer does no work
	let transport: Transporter | undefined;
	return {
		async send(message) {
			if (options.driver === "console") {
				options.logger.info({ to: message.to, subject: message.subject }, "email (console driver)");
				return;
			}
			if (options.driver === "mailgun") {
				const mg = options.mailgun;
				if (!mg) throw new Error("The mailgun driver needs mailgun: { apiKey, domain }");
				const form = new FormData();
				form.set("from", options.from);
				for (const to of list(message.to)) form.append("to", to);
				form.set("subject", message.subject);
				form.set("text", message.text);
				if (message.html) form.set("html", message.html);
				if (message.replyTo) form.set("h:Reply-To", message.replyTo);
				const res = await (options.fetch ?? fetch)(
					`${mg.apiUrl ?? "https://api.mailgun.net"}/v3/${encodeURIComponent(mg.domain)}/messages`,
					{
						method: "POST",
						headers: {
							authorization: `Basic ${Buffer.from(`api:${mg.apiKey}`).toString("base64")}`,
						},
						body: form,
					},
				);
				if (!res.ok) throw new Error(`Mailgun answered ${res.status}: ${await res.text()}`);
				return;
			}
			if (!options.smtpUrl) throw new Error("The smtp driver needs smtpUrl");
			transport ??= createTransport(options.smtpUrl);
			await transport.sendMail({ from: options.from, ...message });
		},
	};
}
