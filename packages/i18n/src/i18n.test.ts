import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createI18n } from "./index.ts";

const i18n = createI18n({
	dictionaries: {
		en: { errors: { NOT_FOUND: "Not found" }, hello: "Hello {name}" },
		ar: { errors: { NOT_FOUND: "غير موجود" } },
	},
	defaultLanguage: "en",
});

function app() {
	const app = new Hono<{ Variables: { language: string } }>();
	app.use(i18n.detectLanguage);
	app.get("/", (c) => c.text(c.get("language")));
	return app;
}

describe("t", () => {
	it("translates with a fallback to the default language, then the fallback text", () => {
		expect(i18n.t("ar", "errors.NOT_FOUND")).toBe("غير موجود");
		expect(i18n.t("fr", "errors.NOT_FOUND")).toBe("Not found");
		expect(i18n.t("en", "missing.key", "Fallback")).toBe("Fallback");
		expect(i18n.t("en", "errors")).toBe("errors");
	});

	it("fills variables and leaves unknown ones", () => {
		expect(i18n.t("en", "hello", "", { name: "Ada" })).toBe("Hello Ada");
		expect(i18n.t("en", "hello")).toBe("Hello {name}");
	});
});

describe("detectLanguage", () => {
	it.each<[{ url: string; cookie?: string; accept?: string }, string]>([
		[{ url: "/?lang=ar" }, "ar"],
		[{ url: "/", cookie: "x=1; lang=ar" }, "ar"],
		[{ url: "/", accept: "fr-FR, ar-SA;q=0.9" }, "ar"],
		[{ url: "/?lang=fr", accept: "de" }, "en"],
		[{ url: "/?lang=en", cookie: "lang=ar" }, "en"],
	])("%j → %s", async ({ url, cookie, accept }, expected) => {
		const res = await app().request(url, {
			headers: { ...(cookie ? { cookie } : {}), ...(accept ? { "accept-language": accept } : {}) },
		});
		expect(await res.text()).toBe(expected);
		expect(res.headers.get("content-language")).toBe(expected);
	});
});
