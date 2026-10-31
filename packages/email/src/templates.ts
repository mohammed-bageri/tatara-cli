import type { z } from "zod";

export interface RenderedEmail {
	subject: string;
	text: string;
	html?: string;
}

export interface EmailDefinition<N extends string = string, S extends z.ZodType = z.ZodType> {
	/** e.g. "billing.invoice-paid" */
	name: N;
	schema: S;
	/** the email in `language` ("en", "ar", …); fall back to a default language yourself */
	render(data: z.infer<S>, language: string): RenderedEmail;
}

/** Default export of every `emails/*.ts`; `tatara sync` lists them. */
export function defineEmail<const N extends string, S extends z.ZodType>(
	definition: EmailDefinition<N, S>,
): EmailDefinition<N, S> {
	return definition;
}

/** Validates `data` against the template's schema and renders it. */
export function renderEmail(
	// biome-ignore lint/suspicious/noExplicitAny: any template, whatever its data
	definition: EmailDefinition<string, any>,
	data: unknown,
	language: string,
): RenderedEmail {
	const parsed = definition.schema.safeParse(data);
	if (!parsed.success)
		throw new Error(`Invalid data for email ${definition.name}: ${parsed.error.message}`);
	return definition.render(parsed.data, language);
}
