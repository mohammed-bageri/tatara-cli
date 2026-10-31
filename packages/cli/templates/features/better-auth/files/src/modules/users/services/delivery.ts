import { createOutbox } from "@tatara/auth";
import { smsSender } from "#modules/users/services/sms";
import { env } from "#core/config/env";
// tatara:slot imports

/** Only with DEV_OUTBOX=true in development or test: the outbox exposes sign-in codes. */
export const outbox = createOutbox({
	enabled: env.DEV_OUTBOX && (env.NODE_ENV === "development" || env.NODE_ENV === "test"),
});

export async function deliverEmail(message: {
	to: string;
	subject: string;
	text: string;
	code?: string;
}): Promise<void> {
	outbox.record({ channel: "email", ...message });
	// tatara:slot email-delivery
}

export async function deliverSms(message: { to: string; text: string; code?: string }): Promise<void> {
	outbox.record({ channel: "sms", ...message });
	await smsSender.send(message.to, message.text);
}
