import path from "node:path";
import { fileURLToPath } from "node:url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

// WeKnora docreader gRPC 客户端（proto vendored 自 WeKnora/docreader/proto，升级 WeKnora 时同步）

const PROTO_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../proto/docreader.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const proto = grpc.loadPackageDefinition(packageDefinition) as any;

const ADDR = process.env.DOCREADER_ADDR ?? "localhost:50061";
const MAX_MSG = 64 * 1024 * 1024; // 大附件简历兜底

function client() {
  return new proto.docreader.DocReader(ADDR, grpc.credentials.createInsecure(), {
    "grpc.max_receive_message_length": MAX_MSG,
    "grpc.max_send_message_length": MAX_MSG,
  });
}

export async function parseDocument(fileContent: Buffer, fileName: string): Promise<string> {
  const fileType = fileName.split(".").pop()?.toLowerCase() ?? "";
  return new Promise((resolve, reject) => {
    const c = client();
    const deadline = new Date(Date.now() + 120_000);
    c.Read(
      { file_content: fileContent, file_name: fileName, file_type: fileType },
      { deadline },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err: Error | null, res: any) => {
        c.close();
        if (err) return reject(new Error(`docreader 调用失败: ${err.message}`));
        if (res?.error) return reject(new Error(`docreader 解析失败: ${res.error}`));
        const md = (res?.markdown_content ?? "").trim();
        if (!md) return reject(new Error("docreader 返回空内容（文件可能损坏或为纯图片且 OCR 未启用）"));
        resolve(md);
      },
    );
  });
}
