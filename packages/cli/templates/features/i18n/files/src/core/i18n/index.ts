import { createMiddleware } from "hono/factory";
import { env } from "#core/config/env";
import type { AppEnv } from "#core/http/context";
import ar from "#locales/ar" with { type: "json" };
import en from "#locales/en" with { type: "json" };

type Dictionary = { [key: string]: string | Dictionary };

const dictionaries: Record<string, Dictionary> = { en, ar };

export const SUPPORTED_LANGUAGES = Object.keys(dictionaries);

function lookup(dict: Dictionary | undefined, key: string): string | undefined {
	let node: string | Dictionary | undefined = dict;
	for (const part of key.split(".")) {
		if (!node || typeof node === "string") return undefined;
		node = node[part];
	}
	return typeof node === "string" ? node : undefined;
}

/** Translates `key` ("errors.NOT_FOUND"), falling back to the default language, then `fallback`. */
export function t(language: string, key: string, fallback = key, vars: Record<string, string> = {}): string {
	const text = lookup(dictionaries[language], key) ?? lookup(dictionaries[env.DEFAULT_LANGUAGE], key) ?? fallback;
	return text.replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? `{${name}}`);
}

/** ?lang, then the `lang` cookie, then Accept-Language; sets `c.var.language`. */
export const detectLanguage = createMiddleware<AppEnv>(async (c, next) => {
	const candidates = [
		c.req.query("lang"),
		/(?:^|;\s*)lang=([^;]+)/.exec(c.req.header("cookie") ?? "")?.[1],
		...(c.req.header("accept-language") ?? "")
			.split(",")
			.map((part) => part.split(";")[0]?.trim().toLowerCase().split("-")[0]),
	];
	const language = candidates.find((l) => l && SUPPORTED_LANGUAGES.includes(l)) ?? env.DEFAULT_LANGUAGE;
	c.set("language", language);
	c.header("content-language", language);
	await next();
});
