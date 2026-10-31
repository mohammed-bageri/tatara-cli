import { z } from "zod";

// controls but tab, newline and carriage return (normalized below)
const CONTROL = /(?![\t\n\r])\p{Cc}/gu;
// format characters (bidi marks, soft hyphens, tags that smuggle text, zero-width…) except the
// joiners Persian and emoji need, and the blank "letters" (Hangul fillers) that look like nothing
const INVISIBLE = /(?![\u200C\u200D])\p{Cf}|[\u034F\u115F\u1160\u3164\uFFA0]/gu;

export interface CleanTextOptions {
	/** keep newlines (collapsing runs of blank lines); otherwise everything is one line */
	multiline?: boolean;
}

/**
 * User text made safe to store and show: NFC-normalized, without control and bidi/zero-width
 * characters, whitespace collapsed, trimmed. It doesn't escape HTML: escape when you render.
 */
export function cleanText(input: string, options: CleanTextOptions = {}): string {
	let text = input.normalize("NFC").replace(CONTROL, "").replace(INVISIBLE, "");
	if (options.multiline) {
		text = text
			.replace(/\r\n?/g, "\n")
			.split("\n")
			.map((line) => line.replace(/[^\S\n]+/g, " ").trim())
			.join("\n")
			.replace(/\n{3,}/g, "\n\n");
	} else {
		text = text.replace(/\s+/g, " ");
	}
	return text.trim();
}

/** A link a user gave, if it's http(s) (or one of `protocols`); null for javascript:, data: and junk. */
export function safeUrl(
	input: string,
	protocols: readonly string[] = ["http:", "https:"],
): string | null {
	try {
		const url = new URL(input.trim());
		// https://bank.com@evil.com reads as the bank; credentials don't belong in stored links
		if (url.username || url.password) return null;
		return protocols.includes(url.protocol) ? url.toString() : null;
	} catch {
		return null;
	}
}

/** A zod string that's cleaned before it's checked, e.g. `text({ max: 120 })` for a title. */
export function text(options: CleanTextOptions & { min?: number; max: number }) {
	return z
		.string()
		.transform((value) => cleanText(value, options))
		.pipe(
			z
				.string()
				.min(options.min ?? 0)
				.max(options.max),
		);
}

/** A zod string that must be a safe http(s) link; it comes out normalized. */
export function url(protocols?: readonly string[]) {
	return z.string().transform((value, ctx) => {
		const safe = safeUrl(value, protocols);
		if (safe === null) {
			ctx.addIssue({ code: "custom", message: "Must be an http(s) link" });
			return z.NEVER;
		}
		return safe;
	});
}
