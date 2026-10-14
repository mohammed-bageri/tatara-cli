import { logger } from "#core/logging/logger";

/** Implement this for your SMS provider and return it from `smsSender`. */
export interface SmsSender {
	send(to: string, text: string): Promise<void>;
}

const consoleSender: SmsSender = {
	async send(to) {
		logger.info({ to }, "sms not sent: no SMS provider configured (see src/core/auth/sms.ts)");
	},
};

export const smsSender: SmsSender = consoleSender;
