import { createElement } from "react";
import { prisma } from "@careeros/db";
import { jsonResume } from "@careeros/shared";
import { auth } from "@/lib/auth";
import { ClassicResume } from "@/lib/pdf/classic-template";

// PDF 导出：react-pdf 服务端渲染，直接流式返回。
// ?inline=1 时浏览器内嵌显示（编辑器预览 iframe 复用同一渲染器，所见即所得）。

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("unauthorized", { status: 401 });
  const { id } = await params;

  const resume = await prisma.resume.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
  });
  if (!resume) return new Response("not found", { status: 404 });

  const parsed = jsonResume.safeParse(resume.resumeJson);
  if (!parsed.success) return new Response("简历内容尚未生成或格式无效", { status: 409 });

  const { renderToBuffer } = await import("@react-pdf/renderer");
  type DocElement = Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(
    createElement(ClassicResume, { resume: parsed.data, lang: resume.resumeType }) as unknown as DocElement,
  );

  const inline = new URL(req.url).searchParams.get("inline") === "1";
  const fileName = encodeURIComponent(`${resume.title.replace(/[\\/:*?"<>|]/g, "_")}.pdf`);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${fileName}`,
      "Cache-Control": "no-store",
    },
  });
}
