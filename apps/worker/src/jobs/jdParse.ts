import { prisma, Prisma } from "@careeros/db";
import { getObjectBuffer } from "../lib/s3";
import { parseDocument } from "../lib/docreader";
import { runJdParse, PROMPT_VERSION } from "../ai/tasks/jdParse";
import { startRun, finishRun } from "../ai/audit";

// JD 解析管线：pending → parsing → parsed / failed
// 文件来源先过 docreader；text/url 来源在 API 层已经拿到纯文本。

export async function handleJdParseJob(jdId: string): Promise<void> {
  const jd = await prisma.jobDescription.findUnique({ where: { id: jdId } });
  if (!jd) throw new Error(`JD 不存在: ${jdId}`);

  try {
    await prisma.jobDescription.update({ where: { id: jdId }, data: { status: "parsing" } });

    let content = jd.rawContent;
    if (jd.fileKey && !content.trim()) {
      const buf = await getObjectBuffer(jd.fileKey);
      const fileName = jd.fileKey.split("/").pop() ?? "jd.pdf";
      const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
      // 纯文本 / Markdown 已是文本，无需 docreader 转换
      const TEXT_EXT = new Set(["txt", "md", "markdown"]);
      if (TEXT_EXT.has(ext)) {
        content = buf.toString("utf-8").trim();
      } else {
        content = await parseDocument(buf, fileName);
      }
      await prisma.jobDescription.update({ where: { id: jdId }, data: { rawContent: content } });
    }

    const run = await startRun({
      userId: jd.userId,
      kind: "jd_parse",
      inputRef: { jdId },
      promptVersion: PROMPT_VERSION,
    });
    const t0 = Date.now();
    try {
      const out = await runJdParse(content);
      await finishRun(run.id, {
        ok: true, model: out.model, tokensIn: out.tokensIn, tokensOut: out.tokensOut, latencyMs: Date.now() - t0,
      });
      await prisma.jobDescription.update({
        where: { id: jdId },
        data: {
          status: "parsed",
          parsed: out.result as Prisma.InputJsonValue,
          // 用户没填时用解析结果补全公司/职位
          company: jd.company ?? out.result.company ?? undefined,
          title: jd.title ?? out.result.title ?? undefined,
        },
      });
    } catch (e) {
      await finishRun(run.id, { ok: false, error: String(e), latencyMs: Date.now() - t0 });
      throw e;
    }
  } catch (e) {
    await prisma.jobDescription.update({ where: { id: jdId }, data: { status: "failed" } });
    throw e;
  }
}
