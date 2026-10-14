/** Object storage used by modules; pick the driver with STORAGE_DRIVER. */
export interface Storage {
	put(key: string, body: Uint8Array | string, contentType?: string): Promise<void>;
	get(key: string): Promise<Uint8Array | null>;
	delete(key: string): Promise<void>;
	/** a URL clients can fetch the object from (signed for S3) */
	url(key: string, expiresInSeconds?: number): Promise<string>;
}

export function assertKey(key: string): string {
	if (!key || key.startsWith("/") || key.split("/").includes("..")) {
		throw new Error(`Invalid storage key "${key}"`);
	}
	return key;
}
