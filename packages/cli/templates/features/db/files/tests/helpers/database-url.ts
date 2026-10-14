/** Number of Vitest workers; global setup prepares one database per worker. */
export const TEST_WORKERS = 4;

/** postgres://…/app_test → postgres://…/app_test_<worker> */
export function workerDatabaseUrl(baseUrl: string, worker: number | string): string {
	const url = new URL(baseUrl);
	url.pathname = `${url.pathname}_${worker}`;
	return url.toString();
}
