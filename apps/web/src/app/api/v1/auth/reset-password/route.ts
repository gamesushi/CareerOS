import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@careeros/db";
import { hashPassword, hashResetToken } from "@/lib/password";
import { ApiError, handler, parseBody } from "@/lib/api";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128),
});

// 密码找回（重置）：校验一次性 token，更新密码并作废该 token（及账号其余未用 token）。
export const POST = handler(async (req) => {
  const { token, password } = await parseBody(req, schema);
  const hashed = hashResetToken(token);

  const record = await prisma.passwordResetToken.findUnique({ where: { token: hashed } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new ApiError(400, "invalid_token", "重置链接无效或已过期，请重新申请");
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
    }),
  ]);

  // 记一条审计（method=password, reason=reset），便于安全追溯。
  await prisma.loginLog.create({
    data: { userId: record.userId, method: "password", success: true, reason: "reset" },
  });

  return NextResponse.json({ ok: true });
});
