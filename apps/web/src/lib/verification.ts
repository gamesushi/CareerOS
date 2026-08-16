import { prisma } from "@careeros/db";
import { generateResetToken } from "@/lib/password";
import { sendEmail, buildEmailVerificationEmail } from "@/lib/email";
import { ApiError } from "@/lib/api";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 验证链接有效期 24 小时
const RESEND_COOLDOWN_MS = 5 * 60 * 1000; // 重发冷却 5 分钟

export interface IssueResult {
  devVerifyUrl?: string;
}

/**
 * 生成并发送邮箱验证邮件。
 * - 复用 VerificationToken 表：DB 仅存 SHA-256(token)，原始 token 只出现在验证链接里。
 * - 限流：距上次发信不足冷却期则抛 ApiError(429)。
 * - 返回 devVerifyUrl 当 SMTP 未配置（dev 调试直接返回链接）；生产未配 SMTP 仅告警、不返回链接。
 */
export async function issueVerificationEmail(email: string, origin?: string): Promise<IssueResult> {
  const normalized = email.trim().toLowerCase();

  // 冷却：最近一次 token 仍在冷却窗口内（剩余有效期 > TTL-冷却）则拒绝过频请求。
  const recent = await prisma.verificationToken.findFirst({
    where: {
      identifier: normalized,
      expires: { gt: new Date(Date.now() + (VERIFY_TTL_MS - RESEND_COOLDOWN_MS)) },
    },
    orderBy: { expires: "desc" },
  });
  if (recent) {
    throw new ApiError(429, "too_frequent", "验证邮件发送过于频繁，请稍后再试");
  }

  const { raw, hashed } = generateResetToken();
  await prisma.verificationToken.create({
    data: { identifier: normalized, token: hashed, expires: new Date(Date.now() + VERIFY_TTL_MS) },
  });

  const base = origin ?? process.env.APP_URL ?? "https://ucareeros.com";
  const verifyUrl = `${base}/verify-email?token=${raw}`;
  const { sent } = await sendEmail({ to: normalized, ...buildEmailVerificationEmail(verifyUrl) });
  if (!sent) {
    if (process.env.NODE_ENV !== "production") {
      return { devVerifyUrl: verifyUrl };
    }
    console.warn("[verification] SMTP 未配置，验证邮件未发送");
  }
  return {};
}
