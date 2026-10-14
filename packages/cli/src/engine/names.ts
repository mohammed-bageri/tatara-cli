export interface Names {
	/** billing-account */
	kebab: string;
	/** BillingAccount */
	pascal: string;
	/** billingAccount */
	camel: string;
	/** billing_account */
	snake: string;
	/** billing-accounts */
	pluralKebab: string;
	/** BillingAccounts */
	pluralPascal: string;
	/** billingAccounts */
	pluralCamel: string;
	/** billing_accounts */
	pluralSnake: string;
	/** Billing account */
	title: string;
}

export function words(input: string): string[] {
	return input
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[^A-Za-z0-9]+/g, " ")
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean);
}

const IRREGULAR: Record<string, string> = {
	person: "people",
	child: "children",
	man: "men",
	woman: "women",
	mouse: "mice",
	goose: "geese",
	tooth: "teeth",
	foot: "feet",
};

const UNCOUNTABLE = new Set([
	"data",
	"information",
	"equipment",
	"news",
	"series",
	"species",
	"media",
]);

export function pluralize(word: string): string {
	if (UNCOUNTABLE.has(word)) return word;
	const irregular = IRREGULAR[word];
	if (irregular) return irregular;
	if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
	if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
	if (/(?:[^f])fe$/.test(word)) return `${word.slice(0, -2)}ves`;
	if (/[^f]f$/.test(word)) return `${word.slice(0, -1)}ves`;
	return `${word}s`;
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

function fromWords(parts: string[]) {
	return {
		kebab: parts.join("-"),
		pascal: parts.map(cap).join(""),
		camel: parts.map((w, i) => (i === 0 ? w : cap(w))).join(""),
		snake: parts.join("_"),
	};
}

export function names(input: string): Names {
	const parts = words(input);
	if (parts.length === 0) throw new Error(`"${input}" is not a valid name`);
	if (!/^[a-z]/.test(parts[0] ?? "")) throw new Error(`"${input}" must start with a letter`);
	const singular = fromWords(parts);
	const pluralParts = [...parts.slice(0, -1), pluralize(parts.at(-1) ?? "")];
	const plural = fromWords(pluralParts);
	return {
		...singular,
		pluralKebab: plural.kebab,
		pluralPascal: plural.pascal,
		pluralCamel: plural.camel,
		pluralSnake: plural.snake,
		title: cap(parts.join(" ")),
	};
}

/** Replaces `__name__`-style tokens (see Names keys) in a string. */
export function applyNames(text: string, prefix: string, n: Names): string {
	return text
		.replaceAll(`__${prefix}PluralKebab__`, n.pluralKebab)
		.replaceAll(`__${prefix}PluralPascal__`, n.pluralPascal)
		.replaceAll(`__${prefix}PluralCamel__`, n.pluralCamel)
		.replaceAll(`__${prefix}PluralSnake__`, n.pluralSnake)
		.replaceAll(`__${prefix}Kebab__`, n.kebab)
		.replaceAll(`__${prefix}Pascal__`, n.pascal)
		.replaceAll(`__${prefix}Camel__`, n.camel)
		.replaceAll(`__${prefix}Snake__`, n.snake)
		.replaceAll(`__${prefix}Title__`, n.title);
}
