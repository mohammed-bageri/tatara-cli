import type { z } from "zod";

export const CHANNELS = ["in-app", "email", "sms", "push"] as const;
export type Channel = (typeof CHANNELS)[number];

export interface InAppContent {
	title: string;
	body?: string;
	/** where the app should take the user, e.g. "/invoices/123" */
	url?: string;
}

export interface EmailContent {
	subject: string;
	text: string;
	html?: string;
}

export interface PushContent {
	title: string;
	body?: string;
	/** string pairs the mobile app receives with the push */
	data?: Record<string, string>;
}

export interface NotificationDefinition<
	N extends string = string,
	S extends z.ZodType = z.ZodType,
> {
	/** e.g. "billing.invoice-paid" */
	name: N;
	description: string;
	schema: S;
	/** the channels it goes out on unless `notify` names others */
	channels: readonly Channel[];
	inApp?(data: z.infer<S>, language: string): InAppContent;
	email?(data: z.infer<S>, language: string): EmailContent;
	sms?(data: z.infer<S>, language: string): string;
	push?(data: z.infer<S>, language: string): PushContent;
}

const RENDERER = { "in-app": "inApp", email: "email", sms: "sms", push: "push" } as const;

/** Default export of every `notifications/*.ts`; each channel it lists needs its renderer. */
export function defineNotification<const N extends string, S extends z.ZodType>(
	definition: NotificationDefinition<N, S>,
): NotificationDefinition<N, S> {
	for (const channel of definition.channels)
		if (!definition[RENDERER[channel]])
			throw new Error(
				`Notification ${definition.name} lists ${channel} but has no ${RENDERER[channel]}()`,
			);
	return definition;
}

/** Renders one channel's content, or undefined when the notification has no renderer for it. */
export function renderChannel(
	// biome-ignore lint/suspicious/noExplicitAny: any notification, whatever its data
	definition: NotificationDefinition<string, any>,
	channel: Channel,
	data: unknown,
	language: string,
) {
	const render = definition[RENDERER[channel]] as
		| ((data: unknown, language: string) => unknown)
		| undefined;
	return render?.(data, language);
}

/** name → the data `notify` takes, from the app's notifications. */
export type NotificationsOf<C extends readonly NotificationDefinition<string, z.ZodType>[]> = {
	[K in C[number] as K["name"]]: z.input<K["schema"]>;
};

/** Who gets it: one user, a list, or everyone in the org with a role or permission. */
export type Recipients =
	| { user: string }
	| { users: readonly string[] }
	| { role: string }
	| { permission: string };
