import { prisma } from "@careeros/db";
import { getSession } from "@/lib/auth";

// SSE：每秒推送导入状态，终态（review/applied/failed）后关闭。
// 前端 TaskProgress 组件消费（docs/design/03 §0）。

const TERMINAL = new Set(["review", "applied", "failed"]);
const MAX_DURATION_MS = 5 * 60 * 1000;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return new Response("unauthorized", { status: 401 });
  const userId = session.user.id;
  const { id } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const started = Date.now();
      let lastStatus = "";
      const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        while (Date.now() - started < MAX_DURATION_MS) {
          const imp = await prisma.resumeImport.findFirst({
            where: { id, userId },
            select: { status: true, error: true },
          });
          if (!imp) {
            send({ status: "not_found" });
            break;
          }
          if (imp.status !== lastStatus) {
            lastStatus = imp.status;
            send({ status: imp.status, error: imp.error });
          }
          if (TERMINAL.has(imp.status)) break;
          await new Promise((r) => setTimeout(r, 1000));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
