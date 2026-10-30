import type { OpenAPIHono } from "@hono/zod-openapi";

type JsonObject = Record<string, unknown>;
type OpenApiDocument = ReturnType<OpenAPIHono["getOpenAPI31Document"]>;
type Paths = NonNullable<OpenApiDocument["paths"]>;
type Components = NonNullable<OpenApiDocument["components"]>;

interface AuthDocument {
	paths?: Record<string, JsonObject>;
	components?: { schemas?: JsonObject; securitySchemes?: JsonObject };
}

/** better-auth with its `openAPI()` plugin. */
export interface OpenApiAuth {
	api: { generateOpenAPISchema(): Promise<unknown> };
}

const SCHEMA_REF = "#/components/schemas/";

// better-auth names schemas like the app (User, Member, …); prefix them so neither side is overwritten
function renameRefs(value: unknown, rename: (name: string) => string): AuthDocument {
	return JSON.parse(
		JSON.stringify(value).replaceAll(
			new RegExp(`"\\$ref":"${SCHEMA_REF}([^"]+)"`, "g"),
			(_match, name: string) => `"$ref":"${SCHEMA_REF}${rename(name)}"`,
		),
	) as AuthDocument;
}

function retag(paths: Record<string, JsonObject>, tag: string): Record<string, JsonObject> {
	for (const operations of Object.values(paths)) {
		for (const operation of Object.values(operations as Record<string, JsonObject>)) {
			if (operation && typeof operation === "object") operation.tags = [tag];
		}
	}
	return paths;
}

/** Adds better-auth's endpoints (served under `basePath`) to the app's OpenAPI document. */
export async function mergeAuthOpenApi(
	document: OpenApiDocument,
	auth: OpenApiAuth,
	basePath: string,
): Promise<void> {
	const authDoc = renameRefs(await auth.api.generateOpenAPISchema(), (name) => `Auth${name}`);

	document.paths ??= {};
	for (const [path, operations] of Object.entries(retag(authDoc.paths ?? {}, "Auth"))) {
		document.paths[`${basePath}${path}`] = operations as Paths[string];
	}

	document.components ??= {};
	document.components.schemas ??= {};
	for (const [name, schema] of Object.entries(authDoc.components?.schemas ?? {})) {
		document.components.schemas[`Auth${name}`] = schema as NonNullable<
			Components["schemas"]
		>[string];
	}
	document.components.securitySchemes = {
		...(authDoc.components?.securitySchemes as Components["securitySchemes"]),
		...document.components.securitySchemes,
	};

	document.tags = [
		...(document.tags ?? []),
		{ name: "Auth", description: "Sign-up, sign-in, sessions, organizations (better-auth)" },
	];
}
