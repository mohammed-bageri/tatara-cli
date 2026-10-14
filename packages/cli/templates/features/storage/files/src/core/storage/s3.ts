import {
	CreateBucketCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadBucketCommand,
	NoSuchKey,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "#core/config/env";
import { assertKey, type Storage } from "#core/storage/storage";

export const s3 = new S3Client({
	region: env.S3_REGION,
	...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
	forcePathStyle: env.S3_FORCE_PATH_STYLE,
	...(env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
		? { credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } }
		: {}),
});

/** Any S3-compatible store (AWS S3, R2, RustFS locally). */
export function s3Storage(bucket = env.S3_BUCKET): Storage {
	let bucketReady: Promise<boolean> | undefined;
	return {
		async put(key, body, contentType) {
			// local development: create the bucket on first write
			if (env.NODE_ENV === "development") {
				bucketReady ??= ensureBucket(bucket);
				await bucketReady;
			}
			await s3.send(
				new PutObjectCommand({ Bucket: bucket, Key: assertKey(key), Body: body, ContentType: contentType }),
			);
		},
		async get(key) {
			try {
				const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: assertKey(key) }));
				return res.Body ? await res.Body.transformToByteArray() : null;
			} catch (error) {
				if (error instanceof NoSuchKey) return null;
				throw error;
			}
		},
		async delete(key) {
			await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: assertKey(key) }));
		},
		async url(key, expiresInSeconds = 900) {
			return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: assertKey(key) }), {
				expiresIn: expiresInSeconds,
			});
		},
	};
}

/** Creates the bucket when it does not exist (local development). */
export async function ensureBucket(bucket = env.S3_BUCKET): Promise<boolean> {
	try {
		await s3.send(new HeadBucketCommand({ Bucket: bucket }));
		return false;
	} catch {
		await s3.send(new CreateBucketCommand({ Bucket: bucket }));
		return true;
	}
}
