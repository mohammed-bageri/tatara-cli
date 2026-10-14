import { smsSender } from "#core/auth/sms";
import { env } from "#core/config/env";
import { logger } from "#core/logging/logger";
// tatara:slot imports

export interface OutboxMessage {
	channel: "email" | "sms";
	to: string;
	subject?: string;
	text: string;
	/** one-time code, when the message carries one */
	code?: string;
	sentAt: string;
}

const outbox: OutboxMessage[] = [];

/** Only with DEV_OUTBOX=true in development or test: the outbox exposes sign-in codes. */
export function outboxEnabled(): boolean {
	return env.DEV_OUTBOX && (env.NODE_ENV === "development" || env.NODE_ENV === "test");
}

/** Messages are kept here so tests and local sign-in can read codes. */
function record(message: Omit<OutboxMessage, "sentAt">) {
	if (!outboxEnabled()) return;
	outbox.push({ ...message, sentAt: new Date().toISOString() });
	if (outbox.length > 200) outbox.shift();
}

/** Newest first. Empty unless the outbox is enabled. */
export function readOutbox(to?: string): OutboxMessage[] {
	if (!outboxEnabled()) return [];
	return outbox.filter((m) => !to || m.to === to).reverse();
}

export async function deliverEmail(message: {
	to: string;
	subject: string;
	text: string;
	code?: string;
}): Promise<void> {
	record({ channel: "email", ...message });
	// tatara:slot email-delivery
}

export async function deliverSms(message: { to: string; text: string; code?: string }): Promise<void> {
	record({ channel: "sms", ...message });
	await smsSender.send(message.to, message.text);
}
