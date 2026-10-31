/** @tatara/i18n: dictionaries, `t()` and language detection for Hono. */
import type { Env, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";

export type Dictionary = { [key: string]: string | Dictionary };

export interface I18nOptions {
	/** language code → strings, e.g. { en, ar } from src/locales */
	dictionaries: Record<string, Dictionary>;
	defaultLanguage: string;
}

function lookup(dict: Dictionary | undefined, key: string): string | undefined {
	let node: string | Dictionary | undefined = dict;
	for (const part of key.split(".")) {
		if (!node || typeof node === "string") return undefined;
		node = node[part];
	}
	return typeof node === "string" ? node : undefined;
}

export function createI18n({ dictionaries, defaultLanguage }: I18nOptions) {
	const languages = Object.keys(dictionaries);

	/** Translates `key` ("errors.NOT_FOUND"), falling back to the default language, then `fallback`. */
	function t(
		language: string,
		key: string,
		fallback = key,
		vars: Record<string, string> = {},
	): string {
		const text =
			lookup(dictionaries[language], key) ?? lookup(dictionaries[defaultLanguage], key) ?? fallback;
		return text.replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? `{${name}}`);
	}

	/** ?lang, then the `lang` cookie, then Accept-Language; sets `c.var.language`. */
	const detectLanguage = createMiddleware<{ Variables: { language: string } }>(async (c, next) => {
		const candidates = [
			c.req.query("lang"),
			/(?:^|;\s*)lang=([^;]+)/.exec(c.req.header("cookie") ?? "")?.[1],
			...(c.req.header("accept-language") ?? "")
				.split(",")
				.map((part) => part.split(";")[0]?.trim().toLowerCase().split("-")[0]),
		];
		const language = candidates.find((l) => l && languages.includes(l)) ?? defaultLanguage;
		c.set("language", language);
		c.header("content-language", language);
		await next();
	}) as unknown as MiddlewareHandler<Env>;
	// typed as adding nothing to the env, so it mounts on any app whose env has `language`

	return { languages, t, detectLanguage };
}
