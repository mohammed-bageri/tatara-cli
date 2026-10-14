/** Object storage used by modules; pick the driver with STORAGE_DRIVER. */
export interface Storage {
	put(key: string, body: Uint8Array | string, contentType?: string): Promise<void>;
	get(key: string): Promise<Uint8Array | null>;
	delete(key: string): Promise<void>;
	/** a URL clients can fetch the object from (signed for S3) */
	url(key: string, expiresInSeconds?: number): Promise<string>;
}

/** Keys are relative, forward-slash paths without "..", backslashes, NUL bytes or drive prefixes. */
export function assertKey(key: string): string {
	const invalid =
		!key ||
		key.startsWith("/") ||
		key.includes("\\") ||
		key.includes("\0") ||
		/^[A-Za-z]:/.test(key) ||
		key.split("/").some((segment) => segment === ".." || segment === ".");
	if (invalid) throw new Error(`Invalid storage key "${key}"`);
	return key;
}
