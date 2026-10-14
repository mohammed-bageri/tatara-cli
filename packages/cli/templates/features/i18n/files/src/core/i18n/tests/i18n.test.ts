import { describe, expect, it } from "vitest";
import { t } from "#core/i18n/index";
import { api } from "#tests/helpers/api";

describe("i18n", () => {
	it("translates with a fallback to the default language", () => {
		expect(t("ar", "errors.NOT_FOUND")).toBe("غير موجود");
		expect(t("fr", "errors.NOT_FOUND")).toBe("Not found");
		expect(t("en", "missing.key", "Fallback")).toBe("Fallback");
	});

	it("localizes error messages from Accept-Language", async () => {
		const res = await api.get("/api/nope", { headers: { "accept-language": "ar-SA,ar;q=0.9" } });
		expect(res.status).toBe(404);
		const invalid = await api.get(`/api/greetings?name=${"x".repeat(60)}`, {
			headers: { "accept-language": "ar" },
		});
		expect(invalid.body).toMatchObject({ code: "VALIDATION_ERROR", error: "الطلب غير صالح" });
		expect(invalid.headers.get("content-language")).toBe("ar");
	});
});
