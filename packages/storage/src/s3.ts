import {
	CreateBucketCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadBucketCommand,
	NoSuchKey,
	PutObjectCommand,
	type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertKey, type Storage } from "./storage.ts";

export interface S3StorageOptions {
	/** the app's own S3Client, so it picks region, endpoint and credentials */
	client: S3Client;
	bucket: string;
	/** create the bucket on first write (local development) */
	createBucket?: boolean;
}

/** Any S3-compatible store (AWS S3, R2, RustFS locally). */
export function s3Storage({ client, bucket, createBucket = false }: S3StorageOptions): Storage {
	let bucketReady: Promise<boolean> | undefined;
	return {
		async put(key, body, contentType) {
			if (createBucket) {
				bucketReady ??= ensureBucket(client, bucket);
				await bucketReady;
			}
			await client.send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: assertKey(key),
					Body: body,
					ContentType: contentType,
				}),
			);
		},
		async get(key) {
			try {
				const res = await client.send(
					new GetObjectCommand({ Bucket: bucket, Key: assertKey(key) }),
				);
				return res.Body ? await res.Body.transformToByteArray() : null;
			} catch (error) {
				if (error instanceof NoSuchKey) return null;
				throw error;
			}
		},
		async delete(key) {
			await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: assertKey(key) }));
		},
		async url(key, expiresInSeconds = 900) {
			return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: assertKey(key) }), {
				expiresIn: expiresInSeconds,
			});
		},
	};
}

/** Creates the bucket when it does not exist; true when it was created. */
export async function ensureBucket(client: S3Client, bucket: string): Promise<boolean> {
	try {
		await client.send(new HeadBucketCommand({ Bucket: bucket }));
		return false;
	} catch {
		await client.send(new CreateBucketCommand({ Bucket: bucket }));
		return true;
	}
}
