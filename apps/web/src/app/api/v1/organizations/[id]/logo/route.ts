// 公司 Logo 上传。owner/admin 才能改公司门面。
//
// 刻意**不接受 SVG**：SVG 可以内嵌 <script>，而 Logo 会以 <img> 出现在免登录的公开
// 公司主页上；一旦某天有人改成 <object>/内联渲染就是储存型 XSS。位图格式没这个面。

import { randomUUID } from "node:crypto";
import { prisma } from "@careeros/db";
import { EMPLOYER_ROLES } from "@careeros/shared";
import { handler, ok, requireRole, ApiError } from "@/lib/api";
import { requireOrgMember } from "@/lib/organizations";
import { putObject, deleteObject } from "@/lib/s3";

const ALLOWED = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);
const MAX_SIZE = 2 * 1024 * 1024;

export const POST = handler(async (req, { params }) => {
  const { userId } = await requireRole(EMPLOYER_ROLES);
  const { id } = await params;
  await requireOrgMember(id, userId, ["owner", "admin"]);

  const form = await req.formData().catch(() => {
    throw new ApiError(400, "invalid_form", "请求必须是 multipart/form-data");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "missing_file", "缺少 file 字段");

  const ext = ALLOWED.get(file.type);
  if (!ext) {
    throw new ApiError(400, "unsupported_type", "Logo 只支持 PNG / JPG / WebP");
  }
  if (file.size > MAX_SIZE) throw new ApiError(400, "too_large", "Logo 不能超过 2MB");
  if (file.size === 0) throw new ApiError(400, "empty_file", "文件为空");

  const org = await prisma.organization.findUnique({
    where: { id },
    select: { logoKey: true },
  });

  const key = `org-logos/${id}/${randomUUID()}.${ext}`;
  await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);

  // logoUrl 存应用内相对路径（按 org id，不随 slug 改变而失效）
  await prisma.organization.update({
    where: { id },
    data: { logoKey: key, logoUrl: `/api/public/org-logo/${id}` },
  });

  // 换新图后清掉旧对象，避免 MinIO 里堆废文件（失败不影响主流程）
  if (org?.logoKey && org.logoKey !== key) {
    await deleteObject(org.logoKey).catch((e) => console.error("[logo] 清理旧对象失败:", e));
  }

  return ok({ logoUrl: `/api/public/org-logo/${id}` });
});

export const DELETE = handler(async (_req, { params }) => {
  const { userId } = await requireRole(EMPLOYER_ROLES);
  const { id } = await params;
  await requireOrgMember(id, userId, ["owner", "admin"]);

  const org = await prisma.organization.findUnique({ where: { id }, select: { logoKey: true } });
  if (org?.logoKey) {
    await deleteObject(org.logoKey).catch((e) => console.error("[logo] 删除失败:", e));
  }
  await prisma.organization.update({
    where: { id },
    data: { logoKey: null, logoUrl: null },
  });
  return ok({ ok: true });
});
