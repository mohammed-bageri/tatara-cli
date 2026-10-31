import { describe, expect, it } from "vitest";
import { parseAccessLabel } from "./routes.ts";

describe("parseAccessLabel", () => {
	it("returns 'public' for routes with no security", () => {
		expect(parseAccessLabel([], {})).toBe("public");
		expect(parseAccessLabel(undefined, {})).toBe("public");
	});

	it("returns role names for bearer auth with roles", () => {
		expect(parseAccessLabel([{ bearerAuth: ["admin"] }], {})).toBe("admin");
		expect(parseAccessLabel([{ bearerAuth: ["admin", "editor"] }], {})).toBe("admin, editor");
	});

	it("returns 'authenticated' for bearer auth without specific roles", () => {
		expect(parseAccessLabel([{ bearerAuth: [] }], {})).toBe("authenticated");
	});

	it("returns the security scheme name for non-bearer auth", () => {
		const schemes = {
			gameKey: { type: "apiKey", in: "header", name: "X-Game-Key" },
			cookieAuth: { type: "apiKey", in: "cookie", name: "session" },
		};

		expect(parseAccessLabel([{ gameKey: [] }], schemes)).toBe("gameKey");
		expect(parseAccessLabel([{ cookieAuth: [] }], schemes)).toBe("cookieAuth");
	});

	it("handles multiple security schemes", () => {
		const schemes = {
			bearerAuth: { type: "http", scheme: "bearer" },
			gameKey: { type: "apiKey", in: "header", name: "X-Game-Key" },
		};

		expect(parseAccessLabel([{ bearerAuth: [] }, { gameKey: [] }], schemes)).toBe(
			"authenticated OR gameKey",
		);
	});
});
