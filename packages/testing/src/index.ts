/** @tatara/testing: call apps in-process, and one database per test worker. */

type HttpApp = { request: (path: string, init?: RequestInit) => Response | Promise<Response> };

export interface ApiResponse<T = unknown> {
	status: number;
	headers: Headers;
	body: T;
}

export interface RequestOptions {
	headers?: Record<string, string>;
}

async function send<T>(
	target: HttpApp,
	method: string,
	path: string,
	body: unknown,
	options: RequestOptions = {},
): Promise<ApiResponse<T>> {
	const headers: Record<string, string> = { ...options.headers };
	if (body !== undefined) headers["content-type"] = "application/json";
	const res = await target.request(path, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await res.text();
	let parsed: unknown = text;
	try {
		parsed = text ? JSON.parse(text) : null;
	} catch {}
	return { status: res.status, headers: res.headers, body: parsed as T };
}

/** Calls a Hono app in-process (no network). */
export function client(target: HttpApp) {
	return {
		get: <T = unknown>(path: string, o?: RequestOptions) =>
			send<T>(target, "GET", path, undefined, o),
		post: <T = unknown>(path: string, body?: unknown, o?: RequestOptions) =>
			send<T>(target, "POST", path, body, o),
		put: <T = unknown>(path: string, body?: unknown, o?: RequestOptions) =>
			send<T>(target, "PUT", path, body, o),
		patch: <T = unknown>(path: string, body?: unknown, o?: RequestOptions) =>
			send<T>(target, "PATCH", path, body, o),
		delete: <T = unknown>(path: string, o?: RequestOptions) =>
			send<T>(target, "DELETE", path, undefined, o),
	};
}

/** Number of Vitest workers; global setup prepares one database per worker. */
export const TEST_WORKERS = 4;

/** postgres://…/app_test → postgres://…/app_test_<worker> */
export function workerDatabaseUrl(baseUrl: string, worker: number | string): string {
	const url = new URL(baseUrl);
	url.pathname = `${url.pathname}_${worker}`;
	return url.toString();
}

/** Creates and migrates one database per worker; use from Vitest's global setup. */
export async function prepareTestDatabases(options: {
	baseUrl: string;
	ensureDatabase: (url: string) => Promise<void>;
	migrateDatabase: (url: string) => Promise<void>;
	workers?: number;
}): Promise<void> {
	try {
		await Promise.all(
			Array.from({ length: options.workers ?? TEST_WORKERS }, async (_, i) => {
				const url = workerDatabaseUrl(options.baseUrl, i + 1);
				await options.ensureDatabase(url);
				await options.migrateDatabase(url);
			}),
		);
	} catch (error) {
		throw new Error(
			`Could not prepare the test databases. Is the database running? (\`docker compose up -d --wait\`)\n${String(error)}`,
		);
	}
}
