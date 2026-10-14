import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { env } from "#core/config/env";
import { assertKey, type Storage } from "#core/storage/storage";

/** Files on disk; for development and tests. */
export function localStorage(root = env.STORAGE_LOCAL_DIR): Storage {
	const base = resolve(root);
	const path = (key: string) => {
		const full = resolve(base, assertKey(key));
		if (!full.startsWith(base + sep)) throw new Error(`Invalid storage key "${key}"`);
		return full;
	};
	return {
		async put(key, body) {
			await mkdir(dirname(path(key)), { recursive: true });
			await writeFile(path(key), body);
		},
		async get(key) {
			try {
				return new Uint8Array(await readFile(path(key)));
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
				throw error;
			}
		},
		async delete(key) {
			await rm(path(key), { force: true });
		},
		async url(key) {
			return `file://${path(key)}`;
		},
	};
}
