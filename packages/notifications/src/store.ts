import type { Channel } from "./define.ts";

export interface NotificationRow {
	id: string;
	orgId: string;
	userId: string;
	name: string;
	title: string;
	body: string | null;
	url: string | null;
	readAt: Date | null;
	createdAt: Date;
}

export interface NewNotification {
	id: string;
	orgId: string;
	userId: string;
	name: string;
	/** null when the notification doesn't go in the inbox (email or push only) */
	inApp: { title: string; body?: string; url?: string } | null;
	idempotencyKey: string;
}

/** What the notifications table and push tokens need; Drizzle and Prisma stores ship with the package. */
export interface NotificationStore {
	/**
	 * The record for this delivery, created on first call. `sent` lists the channels already out,
	 * so a retried delivery sends only what's left.
	 */
	claim(row: NewNotification): Promise<{ id: string; sent: Channel[] }>;
	markSent(id: string, channel: Channel): Promise<void>;
	/** the user's inbox, newest first; `before` is the last row of the previous page */
	list(
		orgId: string,
		userId: string,
		options: { limit: number; before?: { createdAt: Date; id: string }; unreadOnly?: boolean },
	): Promise<NotificationRow[]>;
	unreadCount(orgId: string, userId: string): Promise<number>;
	/** marks the user's own notifications read: the ids given, or all of them */
	markRead(orgId: string, userId: string, ids: readonly string[] | "all"): Promise<number>;
	pushTokens(userId: string): Promise<string[]>;
	addPushToken(userId: string, token: string, device: string | null): Promise<void>;
	removePushTokens(tokens: readonly string[]): Promise<void>;
}
