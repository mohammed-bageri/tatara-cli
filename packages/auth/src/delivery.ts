import type { CoreLogger } from "@tatara/core";

export interface OutboxMessage {
	channel: "email" | "sms";
	to: string;
	subject?: string;
	text: string;
	/** one-time code, when the message carries one */
	code?: string;
	sentAt: string;
}

export interface Outbox {
	readonly enabled: boolean;
	record(message: Omit<OutboxMessage, "sentAt">): void;
	/** Newest first. Empty unless the outbox is enabled. */
	read(to?: string): OutboxMessage[];
}

/** Keeps sent messages in memory so tests and local sign-in can read codes. Never enable in production. */
export function createOutbox(options: { enabled: boolean; limit?: number }): Outbox {
	const limit = options.limit ?? 200;
	const messages: OutboxMessage[] = [];
	return {
		enabled: options.enabled,
		record(message) {
			if (!options.enabled) return;
			messages.push({ ...message, sentAt: new Date().toISOString() });
			if (messages.length > limit) messages.shift();
		},
		read(to) {
			if (!options.enabled) return [];
			return messages.filter((m) => !to || m.to === to).reverse();
		},
	};
}

/** Implement this for your SMS provider. */
export interface SmsSender {
	send(to: string, text: string): Promise<void>;
}

/** Logs instead of sending, until the app configures a provider. */
export function consoleSmsSender(logger: CoreLogger): SmsSender {
	return {
		async send(to) {
			logger.info({ to }, "sms not sent: no SMS provider configured");
		},
	};
}
