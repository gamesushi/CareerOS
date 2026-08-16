import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@careeros/db";
import { hashPassword } from "@/lib/password";
import { CURRENT_TOS_VERSION } from "@/lib/tos";
import { issueVerificationEmail } from "@/lib/verification";
import { negotiateLocale } from "@/lib/i18n/config";
import { getPublicOrigin } from "@/lib/origin";
import { ApiError, handler, parseBody } from "@/lib/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  tosAccepted: z.literal(true),
});

// 自助注册：创建本地密码账号并留痕同意条款。
// 安全：邮箱已存在时直接拒绝（409），不允许通过注册给既有账号（含仅 Google 的账号）设置密码，
// 避免「用本地密码接管 OAuth 账号」的枚举风险；OAuth 用户想加密码应走 /forgot-password（需重置链接）。
export const POST = handler(async (req) => {
  const { email, password } = await parseBody(req, schema);
  const normalized = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  if (existing) {
    throw new ApiError(409, "email_registered", "该邮箱已注册，请直接登录或找回密码");
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      email: normalized,
      name: normalized.split("@")[0],
      passwordHash,
      locale: negotiateLocale(req.headers.get("accept-language")),
      tosAcceptedAt: new Date(),
      tosVersion: CURRENT_TOS_VERSION,
      // emailVerified 保持 null：注册后必须经由验证邮件确认邮箱归属（PIPL 邮箱验证）。
    },
  });

  // 注册即发验证邮件。dev 未配 SMTP 时直接返回 devVerifyUrl 方便联调；
  // 冷却期内的 429 忽略（账号已创建，用户稍后可在 banner 里重发）。
  let devVerifyUrl: string | undefined;
  try {
    const origin = getPublicOrigin(req);
    const r = await issueVerificationEmail(normalized, origin);
    devVerifyUrl = r.devVerifyUrl;
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 429)) throw e;
  }

  return NextResponse.json({ ok: true, devVerifyUrl }, { status: 201 });
});
