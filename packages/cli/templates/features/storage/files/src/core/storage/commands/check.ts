import { defineCommand } from "@tatara/core";
import { env } from "#core/config/env";
import { ensureBucket } from "@tatara/storage/s3";
import { s3, storage } from "#core/storage/index";

export default defineCommand({
	name: "storage:check",
	description: "Create the bucket if needed, then write, read and delete a probe object",
	async run(_args, { logger }) {
		if (env.STORAGE_DRIVER === "s3" && (await ensureBucket(s3, env.S3_BUCKET))) logger.info({ bucket: env.S3_BUCKET }, "bucket created");
		const key = `tatara-check/${Date.now()}.txt`;
		await storage.put(key, "ok", "text/plain");
		const body = await storage.get(key);
		await storage.delete(key);
		if (new TextDecoder().decode(body ?? new Uint8Array()) !== "ok") throw new Error("storage round-trip failed");
		logger.info({ driver: env.STORAGE_DRIVER }, "storage OK");
	},
});
