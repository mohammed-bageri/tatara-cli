import { env } from "#core/config/env";
import { localStorage } from "#core/storage/local";
import { s3Storage } from "#core/storage/s3";
import type { Storage } from "#core/storage/storage";

export type { Storage } from "#core/storage/storage";

export const storage: Storage = env.STORAGE_DRIVER === "s3" ? s3Storage() : localStorage();
