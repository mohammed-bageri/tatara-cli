import { createRoute } from "@hono/zod-openapi";
import {
	errorResponses,
	jsonBody,
	jsonContent,
	paginated,
	paginatedSchema,
	paginationQuerySchema,
	success,
	successSchema,
} from "#core/http/response";
import { createRouter, defineRoutes } from "#core/http/routes";
// tatara:slot imports
import {
	create__namePascal__,
	get__namePascal__,
	list__namePluralPascal__,
	remove__namePascal__,
	update__namePascal__,
} from "#modules/__moduleKebab__/services/__nameKebab__.service";
import {
	__nameCamel__ParamsSchema,
	__nameCamel__Schema,
	create__namePascal__Schema,
	update__namePascal__Schema,
} from "#modules/__moduleKebab__/validators/__nameKebab__.validators";

const router = createRouter();
const tags = ["__namePluralPascal__"];

router.openapi(
	createRoute({
		method: "get",
		path: "/",
		tags,
		summary: "List __namePluralKebab__",
		// tatara:slot guard-list
		request: { query: paginationQuerySchema },
		responses: {
			200: jsonContent(paginatedSchema(__nameCamel__Schema), "A page of __namePluralKebab__"),
			...errorResponses(400),
			// tatara:slot auth-errors
		},
	}),
	async (c) => {
		const query = c.req.valid("query");
		const { items, total } = await list__namePluralPascal__(query);
		return c.json(paginated(items, query.page, query.pageSize, total), 200);
	},
);

router.openapi(
	createRoute({
		method: "get",
		path: "/{id}",
		tags,
		summary: "Get a __nameKebab__",
		// tatara:slot guard-read
		request: { params: __nameCamel__ParamsSchema },
		responses: {
			200: jsonContent(successSchema(__nameCamel__Schema), "The __nameKebab__"),
			...errorResponses(400, 404),
			// tatara:slot auth-errors
		},
	}),
	async (c) => c.json(success(await get__namePascal__(c.req.valid("param").id)), 200),
);

router.openapi(
	createRoute({
		method: "post",
		path: "/",
		tags,
		summary: "Create a __nameKebab__",
		// tatara:slot guard-create
		request: { body: jsonBody(create__namePascal__Schema, "The new __nameKebab__") },
		responses: {
			201: jsonContent(successSchema(__nameCamel__Schema), "Created"),
			...errorResponses(400),
			// tatara:slot auth-errors
		},
	}),
	async (c) => c.json(success(await create__namePascal__(c.req.valid("json"))), 201),
);

router.openapi(
	createRoute({
		method: "patch",
		path: "/{id}",
		tags,
		summary: "Update a __nameKebab__",
		// tatara:slot guard-update
		request: {
			params: __nameCamel__ParamsSchema,
			body: jsonBody(update__namePascal__Schema, "Fields to change"),
		},
		responses: {
			200: jsonContent(successSchema(__nameCamel__Schema), "Updated"),
			...errorResponses(400, 404),
			// tatara:slot auth-errors
		},
	}),
	async (c) =>
		c.json(success(await update__namePascal__(c.req.valid("param").id, c.req.valid("json"))), 200),
);

router.openapi(
	createRoute({
		method: "delete",
		path: "/{id}",
		tags,
		summary: "Delete a __nameKebab__",
		// tatara:slot guard-delete
		request: { params: __nameCamel__ParamsSchema },
		responses: {
			204: { description: "Deleted" },
			...errorResponses(400, 404),
			// tatara:slot auth-errors
		},
	}),
	async (c) => {
		await remove__namePascal__(c.req.valid("param").id);
		return c.body(null, 204);
	},
);

export default defineRoutes({ app: "api", basePath: "/__namePluralKebab__", router });
