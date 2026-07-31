import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@careeros/db";
import { hashResetToken } from "@/lib/password";
import { ApiError, handler, parseBody } from "@/lib/api";

const schema = z.object({ token: z.string().min(10) });

// 邮箱验证：校验一次性 token，置 emailVerified，并作废该 token。
// 已验证账号幂等返回成功（清理可能残留的 token）。
export const POST = handler(async (req) => {
  const { token } = await parseBody(req, schema);
  const hashed = hashResetToken(token);

  const record = await prisma.verificationToken.findUnique({ where: { token: hashed } });
  if (!record || record.expires < new Date()) {
    throw new ApiError(400, "invalid_token", "验证链接无效或已过期，请重新申请");
  }

  const user = await prisma.user.findUnique({ where: { email: record.identifier } });
  if (!user) {
    throw new ApiError(400, "invalid_token", "验证链接无效或已过期，请重新申请");
  }

  if (user.emailVerified) {
    await prisma.verificationToken.delete({ where: { token: hashed } }).catch(() => {});
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.delete({ where: { token: hashed } }),
  ]);

  return NextResponse.json({ ok: true });
});
