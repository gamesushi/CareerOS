import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9100",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "careeros",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "careeros_dev",
  },
  forcePathStyle: true, // MinIO 必需
});

export const BUCKET = process.env.S3_BUCKET ?? "careeros-files";

export async function putObject(key: string, body: Buffer, contentType: string) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** 读对象。不存在返回 null（S3 抛 NoSuchKey，调用方多半想要 404 而不是 500）。 */
export async function getObject(
  key: string,
): Promise<{ body: Uint8Array; contentType: string } | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    if (!res.Body) return null;
    return {
      body: await res.Body.transformToByteArray(),
      contentType: res.ContentType ?? "application/octet-stream",
    };
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw e;
  }
}

