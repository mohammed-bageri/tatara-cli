import { S3Client } from "@aws-sdk/client-s3";
import { localStorage, type Storage } from "@tatara/storage";
import { s3Storage } from "@tatara/storage/s3";
import { env } from "#core/config/env";

export type { Storage } from "@tatara/storage";

export const s3 = new S3Client({
	region: env.S3_REGION,
	...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
	forcePathStyle: env.S3_FORCE_PATH_STYLE,
	...(env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
		? { credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } }
		: {}),
});

/** Object storage for modules; pick the driver with STORAGE_DRIVER. */
export const storage: Storage =
	env.STORAGE_DRIVER === "s3"
		? // local development: the bucket is created on first write
			s3Storage({ client: s3, bucket: env.S3_BUCKET, createBucket: env.NODE_ENV === "development" })
		: localStorage(env.STORAGE_LOCAL_DIR);
