import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { z } from "zod";
import { prisma } from "@careeros/db";
import { sendEmail, buildOtpEmail } from "@/lib/email";
import { ApiError, handler, parseBody } from "@/lib/api";

const schema = z.object({ email: z.string().email() });

const OTP_TTL_MS = 10 * 60 * 1000; // 验证码有效期 10 分钟
const OTP_RESEND_LIMIT = 5; // 同邮箱 10 分钟内最多发 5 次
const OTP_WINDOW_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5; // 单条码最多试 5 次

// 申请登录验证码（OTP）：生成 6 位码存入 EmailOtp，邮件发送。
// 响应始终 200 且不区分邮箱是否存在，避免账号枚举；未配置 SMTP（dev）时回退为返回 devCode。
export const POST = handler(async (req) => {
  const { email } = await parseBody(req, schema);
  const normalized = email.trim().toLowerCase();

  const recent = await prisma.emailOtp.count({
    where: { email: normalized, createdAt: { gt: new Date(Date.now() - OTP_WINDOW_MS) } },
  });
  if (recent >= OTP_RESEND_LIMIT) {
    throw new ApiError(429, "too_many_requests", "验证码发送过于频繁，请稍后再试");
  }

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });

  const dev = process.env.NODE_ENV !== "production";
  const generic = { ok: true, message: "如果该邮箱已注册，登录验证码已发送（开发环境请查看下方 devCode）。" };

  // 仅对存在的账号发码，避免被用来探测哪些邮箱已注册。
  if (user) {
    const code = randomInt(100000, 1000000).toString();
    // 先清掉该邮箱其它有效码，保证同时只有一条有效。
    await prisma.emailOtp.deleteMany({ where: { email: normalized } });
    await prisma.emailOtp.create({
      data: { email: normalized, code, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });

    const { sent } = await sendEmail({ to: normalized, ...buildOtpEmail(code) });
    if (!sent && !dev) {
      console.warn("[request-otp] SMTP 未配置，验证码邮件未发送，用户将收不到邮件");
    }
    // 开发环境始终回显验证码，方便本地测试（与 forgot-password 的 dev 回退一致）。
    if (dev) {
      return NextResponse.json({ ...generic, devCode: code });
    }
  }

  return NextResponse.json(generic);
});
