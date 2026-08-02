// 公开读取公司 Logo。免登录——它出现在免登录的公司主页 /c/<slug> 上。
//
// 只按 organizations.logoKey 取对象，不接受调用方传 key，
// 否则就成了任意读取对象存储的洞。

import { prisma } from "@careeros/db";
import { getObject } from "@/lib/s3";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("not found", { status: 404 });

  const org = await prisma.organization.findUnique({
    where: { id },
    select: { logoKey: true },
  });
  if (!org?.logoKey) return new Response("not found", { status: 404 });

  const obj = await getObject(org.logoKey);
  if (!obj) return new Response("not found", { status: 404 });

  return new Response(new Uint8Array(obj.body) as unknown as BodyInit, {
    headers: {
      "Content-Type": obj.contentType,
      // key 里带 uuid，换图即换 key，可以放心长缓存
      "Cache-Control": "public, max-age=86400",
      "Content-Security-Policy": "default-src 'none'", // 纵深防御：即便将来误传了可执行内容也不给它执行环境
    },
  });
}
