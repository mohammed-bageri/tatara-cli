import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./html.ts";

describe("sanitizeHtml", () => {
	it("keeps formatting and drops anything that runs or loads", () => {
		const dirty =
			'<p onclick="x()">Hi <b>there</b><script>alert(1)</script><iframe src="https://x"></iframe>' +
			'<a href="javascript:alert(1)">bad</a> <a href="https://ok.dev" target="_blank">ok</a></p>' +
			'<img src="https://x/y.png" onerror="z()">';
		const clean = sanitizeHtml(dirty);
		expect(clean).toBe(
			'<p>Hi <b>there</b><a rel="noopener noreferrer">bad</a> <a href="https://ok.dev" target="_blank" rel="noopener noreferrer">ok</a></p>',
		);
	});

	it("keeps images, tables and safe inline styles for email", () => {
		const clean = sanitizeHtml(
			'<table><tr><td style="color: #333; position: fixed; background-image: url(x)">A</td></tr></table>' +
				'<img src="https://cdn.x/logo.png" alt="logo"><img src="http://insecure/x.png">',
			"email",
		);
		expect(clean).toContain('<td style="color:#333">A</td>');
		expect(clean).toContain('<img src="https://cdn.x/logo.png" alt="logo" />');
		expect(clean).not.toContain("insecure");
	});
});
