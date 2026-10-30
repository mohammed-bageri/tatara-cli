import { client } from "@tatara/testing";
import { app as apiApp } from "#apps/api/app";
// tatara:slot imports

export type { ApiResponse, RequestOptions } from "@tatara/testing";
export { client };

/** Calls the api app in-process (no network). */
export const api = client(apiApp);
// tatara:slot exports
