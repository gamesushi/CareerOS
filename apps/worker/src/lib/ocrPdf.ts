import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

// 本地 OCR 兜底：当 docreader 无法从 PDF 抽出文字（扫描件 / 退化文字层）时，
// 用 pdftoppm 把每页渲染成 PNG，再用 tesseract（中文 chi_sim + 英文 eng）识别，
// 合并为 markdown 文本交给下游 LLM 抽取。完全离线，不依赖任何外部 API。

const OCR_TIMEOUT_MS = 120_000;

function run(cmd: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export async function ocrPdfToMarkdown(file: Buffer, fileName: string): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext !== "pdf") {
    throw new Error(`OCR 兜底仅支持 PDF；${ext || "未知"} 类型 docreader 解析失败且无可用 OCR`);
  }

  const dir = await fs.mkdtemp(path.join(tmpdir(), "careeros-ocr-"));
  const pdfPath = path.join(dir, "src.pdf");
  await fs.writeFile(pdfPath, file);

  try {
    const imgPrefix = path.join(dir, "page");
    // 渲染每页为 PNG（200 DPI，平衡清晰度与速度）
    await run("pdftoppm", ["-png", "-r", "200", pdfPath, imgPrefix], OCR_TIMEOUT_MS);

    const files = (await fs.readdir(dir))
      .filter((f) => f.startsWith("page") && f.endsWith(".png"))
      .sort();
    if (files.length === 0) {
      throw new Error("OCR 兜底失败：pdftoppm 未生成任何页面图片（PDF 可能已损坏）");
    }

    const pages: string[] = [];
    for (const f of files) {
      const text = await new Promise<string>((resolve, reject) => {
        execFile(
          "tesseract",
          [path.join(dir, f), "stdout", "-l", "chi_sim+eng", "--psm", "3"],
          { timeout: OCR_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
          (err, stdout) => {
            if (err) return reject(err);
            resolve(stdout);
          },
        );
      });
      pages.push(text.trim());
    }

    const merged = pages
      .map((p, i) => (pages.length > 1 ? `\n\n<!-- page ${i + 1} -->\n\n` : "") + p)
      .join("\n")
      .trim();

    if (!merged) {
      throw new Error("OCR 兜底未识别出任何文字（页面可能为无文字的纯图片）");
    }
    return merged;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
