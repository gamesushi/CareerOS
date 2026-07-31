import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@careeros/db";
import { issueVerificationEmail } from "@/lib/verification";
import { ApiError, handler, parseBody } from "@/lib/api";

const schema = z.object({ email: z.string().email() });

// 重发验证邮件：已验证返回 409（提示已验证）；未验证则发信。
// 不存在的邮箱也返回 200（不泄露账号是否存在）。
export const POST = handler(async (req) => {
  const { email } = await parseBody(req, schema);
  const normalized = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, email: true, emailVerified: true },
  });
  if (!user) {
    return NextResponse.json({
      ok: true,
      message: "如果该邮箱已注册且未验证，验证邮件已生成。",
    });
  }
  if (user.emailVerified) {
    throw new ApiError(409, "already_verified", "该邮箱已验证");
  }

  const origin = new URL(req.url).origin;
  const r = await issueVerificationEmail(normalized, origin);
  const body: Record<string, unknown> = { ok: true, message: "验证邮件已生成。" };
  if (r.devVerifyUrl) body.devVerifyUrl = r.devVerifyUrl;
  return NextResponse.json(body);
});
