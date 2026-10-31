import { createSign } from "node:crypto";
import type { CoreLogger } from "@tatara/core";
import type { PushContent } from "./define.ts";
import type { PushSender, SmsSender } from "./notifier.ts";

/** SMS through Twilio's REST API. */
export function twilioSms(options: {
	accountSid: string;
	authToken: string;
	/** a Twilio number or messaging service sid (MG…) */
	from: string;
	fetch?: typeof fetch;
}): SmsSender {
	return {
		async send(to, text) {
			const body = new URLSearchParams({ To: to, Body: text });
			body.set(options.from.startsWith("MG") ? "MessagingServiceSid" : "From", options.from);
			const res = await (options.fetch ?? fetch)(
				`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(options.accountSid)}/Messages.json`,
				{
					method: "POST",
					headers: {
						authorization: `Basic ${Buffer.from(`${options.accountSid}:${options.authToken}`).toString("base64")}`,
					},
					body,
				},
			);
			if (!res.ok) throw new Error(`Twilio answered ${res.status}: ${await res.text()}`);
		},
	};
}

/** Logs instead of sending: development, tests, and apps without a provider yet. */
export function consoleSms(logger: CoreLogger): SmsSender {
	return {
		async send(to) {
			logger.info({ to }, "sms (console driver)");
		},
	};
}

export function consolePush(logger: CoreLogger): PushSender {
	return {
		async send(tokens, content) {
			logger.info({ devices: tokens.length, title: content.title }, "push (console driver)");
			return { invalidTokens: [] };
		},
	};
}

const base64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

/**
 * Push through Firebase Cloud Messaging (HTTP v1) with a service account. Tokens FCM says are
 * unregistered come back as invalid, for the store to forget.
 */
export function fcmPush(options: {
	projectId: string;
	clientEmail: string;
	/** the service account's private key (PEM); "\n" escapes from env files are fine */
	privateKey: string;
	fetch?: typeof fetch;
}): PushSender {
	const http = options.fetch ?? fetch;
	const key = options.privateKey.replace(/\\n/g, "\n");
	let token: { value: string; expiresAt: number } | undefined;

	async function accessToken(): Promise<string> {
		if (token && token.expiresAt > Date.now() + 60_000) return token.value;
		const now = Math.floor(Date.now() / 1000);
		const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
		const claims = base64url(
			JSON.stringify({
				iss: options.clientEmail,
				scope: "https://www.googleapis.com/auth/firebase.messaging",
				aud: "https://oauth2.googleapis.com/token",
				iat: now,
				exp: now + 3600,
			}),
		);
		const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(key);
		const res = await http("https://oauth2.googleapis.com/token", {
			method: "POST",
			body: new URLSearchParams({
				grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
				assertion: `${header}.${claims}.${base64url(signature)}`,
			}),
		});
		if (!res.ok) throw new Error(`Google OAuth answered ${res.status}: ${await res.text()}`);
		const body = (await res.json()) as { access_token: string; expires_in: number };
		token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
		return token.value;
	}

	return {
		async send(tokens, content: PushContent) {
			const bearer = await accessToken();
			const invalidTokens: string[] = [];
			const failures: string[] = [];
			await Promise.all(
				tokens.map(async (device) => {
					const res = await http(
						`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(options.projectId)}/messages:send`,
						{
							method: "POST",
							headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
							body: JSON.stringify({
								message: {
									token: device,
									notification: { title: content.title, body: content.body },
									...(content.data ? { data: content.data } : {}),
								},
							}),
						},
					);
					if (res.ok) return;
					const text = await res.text();
					if (res.status === 404 || text.includes("UNREGISTERED")) invalidTokens.push(device);
					else failures.push(`${res.status}: ${text}`);
				}),
			);
			// every device failed for a reason other than being gone: let the job retry
			if (
				failures.length > 0 &&
				failures.length + invalidTokens.length === tokens.length &&
				invalidTokens.length === 0
			)
				throw new Error(`FCM failed: ${failures[0]}`);
			return { invalidTokens };
		},
	};
}
