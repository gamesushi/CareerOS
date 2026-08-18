import { parseDocument } from "./docreader";
import { ocrPdfToMarkdown } from "./ocrPdf";

// 统一的文档文本提取入口：优先用 docreader（gRPC），失败或返回空/极短内容时
// 自动回退到本地 tesseract OCR（覆盖扫描件、退化文字层等 docreader 抽不出文字的 PDF）。
// 纯文本 / Markdown 直接解码，无需任何外部服务。

const TEXT_EXT = new Set(["txt", "md", "markdown"]);
// docreader 返回的有效内容最小长度；低于此值视为未成功抽取（例如只返回图片引用），改走 OCR。
const MIN_DOCREADER_CHARS = 40;

export async function extractDocumentText(file: Buffer, fileName: string): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (TEXT_EXT.has(ext)) {
    const text = file.toString("utf-8").trim();
    if (!text) throw new Error("文件内容为空（txt/md 解码后无文本）");
    return text;
  }

  // 1) docreader 优先
  try {
    const md = await parseDocument(file, fileName);
    if (md && md.trim().length >= MIN_DOCREADER_CHARS) return md;
  } catch {
    // docreader 调用失败 / 解析失败：落 OCR
  }

  // 2) 本地 OCR 兜底
  return await ocrPdfToMarkdown(file, fileName);
}
