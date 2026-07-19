import { prisma } from "@careeros/db";
import { handler, ok, requireUser, ApiError } from "@/lib/api";
import { aiQueue } from "@/lib/queue";

// 发现的岗位 → 一键导入为 JD：进入既有 解析→匹配 管线。
// 列表接口只给职责摘要（snippet），全文以原链接为准；解析基于现有信息，
// 匹配报告页保留原链接供投递。

export const POST = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const job = await prisma.discoveredJob.findFirst({ where: { id, userId } });
  if (!job) throw new ApiError(404, "not_found", "岗位不存在");
  if (job.jdId) return ok({ jdId: job.jdId, already: true });

  const rawContent = [
    `职位：${job.title}`,
    job.company ? `公司：${job.company}` : "",
    job.location ? `地点：${job.location}` : "",
    job.salary ? `薪资：${job.salary}` : "",
    job.snippet ? `\n职责/要求：\n${job.snippet}` : "",
    `\n原始链接：${job.url}`,
  ]
    .filter(Boolean)
    .join("\n");

  const jd = await prisma.jobDescription.create({
    data: {
      userId,
      company: job.company,
      title: job.title,
      sourceUrl: job.url,
      rawContent,
      status: "pending",
    },
  });
  await prisma.discoveredJob.update({
    where: { id },
    data: { status: "imported", jdId: jd.id },
  });
  await aiQueue.add("jd_parse", { jdId: jd.id }, { jobId: `jd-parse-${jd.id}` });
  return ok({ jdId: jd.id }, 202);
});
