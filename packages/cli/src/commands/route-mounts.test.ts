import { describe, expect, it } from "vitest";
import { routeMountCollisions } from "./route-mounts.ts";

const route = (app: string, basePath: string) =>
	`const router = createRouter();\nexport default defineRoutes({ app: "${app}", basePath: "${basePath}", router });\n`;

describe("routeMountCollisions", () => {
	it("reports a second route file on the same app and base path", () => {
		const sources = new Map([
			["src/modules/games/routes/game.routes.ts", route("api", "/games")],
			["src/modules/games/routes/games.routes.ts", route("api", "/games")],
		]);
		expect(routeMountCollisions(sources)).toEqual([
			{
				file: "src/modules/games/routes/games.routes.ts",
				line: 2,
				rule: "duplicate-base-path",
				message:
					'api "/games" is already mounted by src/modules/games/routes/game.routes.ts; routers on one base path shadow each other, so give this one its own basePath',
			},
		]);
	});

	it("allows the same base path on different apps", () => {
		const sources = new Map([
			["src/modules/a/routes/a.routes.ts", route("api", "/games")],
			["src/modules/a/routes/a-admin.routes.ts", route("admin", "/games")],
		]);
		expect(routeMountCollisions(sources)).toEqual([]);
	});

	it("reads app and basePath in either order and ignores non-route files", () => {
		const sources = new Map([
			["src/modules/a/routes/x.routes.ts", 'defineRoutes({ basePath: "/x", router, app: "api" })'],
			[
				"src/modules/b/routes/y.routes.ts",
				'defineRoutes({\n\tapp: "api",\n\tbasePath: "/x",\n\trouter,\n})',
			],
			["src/modules/b/services/y.ts", route("api", "/x")],
		]);
		expect(routeMountCollisions(sources).map((v) => v.file)).toEqual([
			"src/modules/b/routes/y.routes.ts",
		]);
	});
});
