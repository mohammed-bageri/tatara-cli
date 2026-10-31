import { z } from "zod";

// C0/C1 controls except tab and newline, and the invisible characters that reorder or hide text
const CONTROL = /(?![\t\n])\p{Cc}/gu;
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

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
