import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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
