import sanitize from "sanitize-html";

export type HtmlProfile = "text" | "email";

const TEXT_TAGS = [
	"p",
	"br",
	"b",
	"i",
	"strong",
	"em",
	"u",
	"s",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"ul",
	"ol",
	"li",
	"a",
	"blockquote",
	"code",
	"pre",
	"hr",
	"span",
];
const EMAIL_TAGS = [
	...TEXT_TAGS,
	"img",
	"table",
	"thead",
	"tbody",
	"tr",
	"td",
	"th",
	"div",
	"center",
];
// the look email clients need, nothing that loads or positions content
const SAFE_STYLE = {
	color: [/^#[0-9a-f]{3,8}$/i, /^[a-z]+$/i, /^rgba?\([\d\s,.%]+\)$/i],
	"background-color": [/^#[0-9a-f]{3,8}$/i, /^[a-z]+$/i, /^rgba?\([\d\s,.%]+\)$/i],
	"text-align": [/^(left|right|center|justify)$/],
	"font-size": [/^\d+(px|em|rem|%)$/],
	"font-weight": [/^(normal|bold|\d{3})$/],
	padding: [/^[\d\s.]+(px|em)?(\s+[\d.]+(px|em)?){0,3}$/],
	margin: [/^[\d\s.]+(px|em)?(\s+[\d.]+(px|em)?){0,3}$/],
};

/**
 * HTML from users (rich text, admin-edited email templates) with only formatting left: no scripts,
 * event handlers, iframes, forms or javascript:/data: links. "email" also keeps images, tables and
 * a few inline styles. Links open safely (rel="noopener noreferrer"). Needs `sanitize-html` installed.
 */
export function sanitizeHtml(input: string, profile: HtmlProfile = "text"): string {
	const email = profile === "email";
	return sanitize(input, {
		allowedTags: email ? EMAIL_TAGS : TEXT_TAGS,
		allowedAttributes: {
			a: ["href", "title", "target", "rel"],
			...(email
				? {
						img: ["src", "alt", "width", "height"],
						td: ["colspan", "rowspan"],
						th: ["colspan", "rowspan"],
					}
				: {}),
			...(email ? { "*": ["style", "align"] } : {}),
		},
		allowedStyles: email ? { "*": SAFE_STYLE } : {},
		allowedSchemes: ["http", "https", "mailto"],
		allowedSchemesByTag: { img: ["https"] },
		allowProtocolRelative: false,
		transformTags: {
			a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: "noopener noreferrer" } }),
		},
	});
}
