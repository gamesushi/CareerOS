import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@careeros/db";
import { generateResetToken } from "@/lib/password";
import { sendEmail, buildPasswordResetEmail } from "@/lib/email";
import { getPublicOrigin } from "@/lib/origin";
import { ApiError, handler, parseBody } from "@/lib/api";

const schema = z.object({ email: z.string().email() });

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 小时
const FORGOT_RATE_LIMIT = 3; // 同邮箱 10 分钟内最多申请 3 次
const FORGOT_WINDOW_MS = 10 * 60 * 1000;

// 密码找回（申请）：生成一次性重置 token，DB 仅存其哈希。
// 配置 SMTP 后通过 sendEmail 发送重置邮件；未配置（dev）时回退为直接返回链接。
// 响应始终 200 且不区分邮箱是否存在，避免账号枚举。
export const POST = handler(async (req) => {
  const { email } = await parseBody(req, schema);
  const normalized = email.trim().toLowerCase();

  const recent = await prisma.passwordResetToken.count({
    where: {
      user: { email: normalized },
      usedAt: null,
      createdAt: { gt: new Date(Date.now() - FORGOT_WINDOW_MS) },
    },
  });
  if (recent >= FORGOT_RATE_LIMIT) {
    throw new ApiError(429, "too_many_requests", "重置请求过于频繁，请稍后再试");
  }

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, email: true, passwordHash: true },
  });

  const generic = {
    ok: true,
    message: "如果该邮箱已注册且设置了密码，重置链接已生成（开发环境请查看下方 devResetUrl）。",
  };

  // 发 token 的条件：
  //  - 生产：仅对「已设本地密码」的账号发（无邮件服务时无法验证 OAuth-only 账号的邮箱，避免被枚举接管）。
  //  - 开发：任意已存在账号都发，方便 dev 直登账号首次设置/补一个本地密码。
  const canIssue = !!user && (process.env.NODE_ENV !== "production" || !!user.passwordHash);
  if (canIssue) {
    // 失效同一账号其它未使用的 token，保证同时只有一条有效。
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    const { raw, hashed } = generateResetToken();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: hashed, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    });

    const origin = getPublicOrigin(req);
    const resetUrl = `${origin}/reset-password?token=${raw}`;
    const { sent } = await sendEmail({ to: user.email, ...buildPasswordResetEmail(resetUrl) });
    if (!sent) {
      // 未配置 SMTP（dev / 本地）：回退为直接返回链接，方便测试。
      if (process.env.NODE_ENV !== "production") {
        return NextResponse.json({ ...generic, devResetUrl: resetUrl });
      }
      // 生产环境未配 SMTP：不返回链接（防泄露），仅告警运维。
      console.warn("[forgot-password] SMTP 未配置，重置邮件未发送，用户将收不到邮件");
    }
  }

  return NextResponse.json(generic);
});
