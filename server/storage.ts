// Self-hosted object storage backed by AWS S3.
// Uploads use PutObject directly with the server's AWS credentials (IAM role or
// access keys). Public reads go through the app's /storage/* proxy route, which
// redirects to a short-lived presigned GET URL.

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { ENV } from "./_core/env";

const SIGNED_URL_EXPIRES_SECONDS = 900; // 15 minutes

let _client: S3Client | null = null;

function getS3Config() {
  const region = ENV.s3Region;
  const bucket = ENV.s3Bucket;
  if (!region || !bucket) {
    throw new Error(
      "S3 storage not configured: set AWS_REGION and S3_BUCKET (and AWS credentials via IAM role or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)",
    );
  }
  return { region, bucket };
}

function getS3Client(): S3Client {
  if (_client) return _client;
  const { region } = getS3Config();
  const config: ConstructorParameters<typeof S3Client>[0] = { region };
  if (ENV.s3Endpoint) {
    config.endpoint = ENV.s3Endpoint;
    // Local/MinIO-style endpoints need path-style addressing.
    config.forcePathStyle = true;
  }
  if (ENV.s3AccessKeyId && ENV.s3SecretAccessKey) {
    config.credentials = {
      accessKeyId: ENV.s3AccessKeyId,
      secretAccessKey: ENV.s3SecretAccessKey,
    };
  }
  _client = new S3Client(config);
  return _client;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { bucket } = getS3Config();
  const key = appendHashSuffix(normalizeKey(relKey));

  const body =
    typeof data === "string" ? Buffer.from(data, "utf-8") : Buffer.from(data as Buffer);

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return { key, url: `/storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { bucket } = getS3Config();
  const key = normalizeKey(relKey);
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: SIGNED_URL_EXPIRES_SECONDS },
  );
}