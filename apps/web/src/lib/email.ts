import nodemailer from "nodemailer";

const DEFAULT_FROM = "CareerOS <no-reply@careeros.app>";

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  sent: boolean;
  error?: string;
}

// 单例 transport：有 SMTP_HOST 才创建；dev / 未配置时返回 null，由调用方回退（如返回 devResetUrl）。
let cached: nodemailer.Transporter | null | undefined;

function getTransporter(): nodemailer.Transporter | null {
  if (cached !== undefined) return cached;
  const host = process.env.SMTP_HOST;
  if (!host) {
    cached = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    pool: true,
    maxConnections: 2,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  });
  return cached;
}

/**
 * 发送邮件。未配置 SMTP（dev / 本地）时返回 { sent: false } 且不抛错，
 * 调用方可据此回退到「直接返回链接」等调试手段。
 */
export async function sendEmail(input: EmailInput): Promise<SendResult> {
  const transport = getTransporter();
  if (!transport) return { sent: false };
  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM || DEFAULT_FROM,
      ...input,
    });
    return { sent: true };
  } catch (err) {
    console.error("[email] send failed:", err);
    return { sent: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/** 密码重置邮件（中英文双语，纯内联样式，无外部图片）。 */
export function buildPasswordResetEmail(
  resetUrl: string,
): { subject: string; html: string; text: string } {
  const subject = "CareerOS 密码重置请求 / Password reset request";
  const html = `<!doctype html>
<html lang="zh-CN">
<body style="margin:0;background:#f4f5f7;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:#1a1a1a;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <h2 style="margin:0 0 16px;font-size:18px;font-weight:600;">重置你的 CareerOS 密码</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#444441;">
      我们收到了针对该邮箱的密码重置请求。如果这是你本人操作，请点击下面的按钮设置新密码；如果不是你操作的，请忽略此邮件。
    </p>
    <p style="margin:0 0 16px;text-align:center;">
      <a href="${resetUrl}" style="display:inline-block;background:#185FA5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:12px 28px;border-radius:8px;">重置密码</a>
    </p>
    <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#5f5e5a;">
      或复制以下链接到浏览器打开：<br/>
      <span style="word-break:break-all;color:#185FA5;">${resetUrl}</span>
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#5f5e5a;">
      出于安全考虑，该链接将在 <strong>1 小时</strong> 后失效。
    </p>
    <hr style="border:none;border-top:1px solid #e6e6e6;margin:24px 0;" />
    <p style="margin:0;font-size:12px;color:#888780;">
      We received a request to reset your CareerOS password. The link expires in 1 hour. If you didn't request this, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`;
  const text = `重置你的 CareerOS 密码\n\n我们收到了针对该邮箱的密码重置请求。请打开以下链接设置新密码（1 小时内有效）：\n${resetUrl}\n\n如果不是你本人操作，请忽略此邮件。\n\nWe received a request to reset your CareerOS password. The link expires in 1 hour: ${resetUrl}`;
  return { subject, html, text };
}

/** 邮箱验证邮件（中英文双语，纯内联样式，无外部图片）。 */
export function buildEmailVerificationEmail(
  verifyUrl: string,
): { subject: string; html: string; text: string } {
  const subject = "CareerOS 邮箱验证 / Verify your email";
  const html = `<!doctype html>
<html lang="zh-CN">
<body style="margin:0;background:#f4f5f7;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:#1a1a1a;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <h2 style="margin:0 0 16px;font-size:18px;font-weight:600;">验证你的 CareerOS 邮箱</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#444441;">
      感谢注册 CareerOS！请点击下面的按钮验证你的邮箱，以便启用全部功能。
    </p>
    <p style="margin:0 0 16px;text-align:center;">
      <a href="${verifyUrl}" style="display:inline-block;background:#185FA5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:12px 28px;border-radius:8px;">验证邮箱</a>
    </p>
    <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#5f5e5a;">
      或复制以下链接到浏览器打开：<br/>
      <span style="word-break:break-all;color:#185FA5;">${verifyUrl}</span>
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#5f5e5a;">
      出于安全考虑，该链接将在 <strong>24 小时</strong> 后失效。
    </p>
    <hr style="border:none;border-top:1px solid #e6e6e6;margin:24px 0;" />
    <p style="margin:0;font-size:12px;color:#888780;">
      Thanks for signing up for CareerOS. Verify your email within 24 hours to activate your account: ${verifyUrl}
    </p>
  </div>
</body>
</html>`;
  const text = `验证你的 CareerOS 邮箱\n\n感谢注册！请打开以下链接完成邮箱验证（24 小时内有效）：\n${verifyUrl}\n\nThanks for signing up. Verify your email within 24 hours: ${verifyUrl}`;
  return { subject, html, text };
}

/** 登录验证码邮件（中英文双语，纯内联样式，无外部图片）。 */
export function buildOtpEmail(code: string): { subject: string; html: string; text: string } {
  const subject = "CareerOS 登录验证码 / Your login code";
  const html = `<!doctype html>
<html lang="zh-CN">
<body style="margin:0;background:#f4f5f7;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:#1a1a1a;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <h2 style="margin:0 0 16px;font-size:18px;font-weight:600;">你的登录验证码</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#444441;">
      以下是你的 CareerOS 登录验证码，10 分钟内有效。请勿将验证码告知他人。
    </p>
    <p style="margin:0 0 16px;text-align:center;">
      <span style="display:inline-block;background:#f0f4f9;color:#185FA5;font-size:28px;font-weight:700;letter-spacing:6px;padding:14px 28px;border-radius:8px;">${code}</span>
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#5f5e5a;">
      如果这不是你本人的操作，请忽略此邮件，你的账号不会受到影响。
    </p>
    <hr style="border:none;border-top:1px solid #e6e6e6;margin:24px 0;" />
    <p style="margin:0;font-size:12px;color:#888780;">
      This is your CareerOS login code. It expires in 10 minutes. If you didn't request it, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`;
  const text = `你的 CareerOS 登录验证码：${code}（10 分钟内有效）。\n\nThis is your CareerOS login code: ${code} (valid for 10 minutes).`;
  return { subject, html, text };
}
