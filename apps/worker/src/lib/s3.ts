import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

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

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}
