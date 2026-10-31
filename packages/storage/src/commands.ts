import type { S3Client } from "@aws-sdk/client-s3";
import { type CommandDefinition, defineCommand } from "@tatara/core";
import { ensureBucket } from "./s3.ts";
import type { Storage } from "./storage.ts";

export interface StorageCommandsOptions {
	storage: Storage;
	s3: S3Client;
	env: { STORAGE_DRIVER: string; S3_BUCKET: string };
}

/** storage:check; wired into the app by `tatara sync`. */
export function storageCommands({ storage, s3, env }: StorageCommandsOptions): CommandDefinition[] {
	return [
		defineCommand({
			name: "storage:check",
			description: "Create the bucket if needed, then write, read and delete a probe object",
			async run(_args, { logger }) {
				if (env.STORAGE_DRIVER === "s3" && (await ensureBucket(s3, env.S3_BUCKET)))
					logger.info({ bucket: env.S3_BUCKET }, "bucket created");
				const key = `tatara-check/${Date.now()}.txt`;
				await storage.put(key, "ok", "text/plain");
				const body = await storage.get(key);
				await storage.delete(key);
				if (new TextDecoder().decode(body ?? new Uint8Array()) !== "ok")
					throw new Error("storage round-trip failed");
				logger.info({ driver: env.STORAGE_DRIVER }, "storage OK");
			},
		}),
	];
}
