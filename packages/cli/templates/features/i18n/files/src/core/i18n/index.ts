import { createI18n } from "@tatara/i18n";
import { env } from "#core/config/env";
import ar from "#locales/ar" with { type: "json" };
import en from "#locales/en" with { type: "json" };

const i18n = createI18n({ dictionaries: { en, ar }, defaultLanguage: env.DEFAULT_LANGUAGE });

export const SUPPORTED_LANGUAGES = i18n.languages;

/** `t(language, "errors.NOT_FOUND")`, and the middleware that sets `c.var.language`. */
export const { t, detectLanguage } = i18n;
