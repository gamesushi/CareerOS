import nodemailer from "nodemailer";

// worker 侧的 SMTP transport。与 apps/web/src/lib/email.ts 是同一套配置的两份实例——
// 没有合并是因为 web 需要它做密码找回（请求内同步发），而 worker 是通知队列的唯一消费者；
// 抽到 @careeros/db 会给那个包平白加 nodemailer 依赖。改配置时两处要同步。

const DEFAULT_FROM = "CareerOS <no-reply@careeros.app>";

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
 * 发信。未配置 SMTP 时返回 sent:false 并打日志——本地开发不该因为没配邮箱而让
 * 队列任务反复失败重试。
 */
export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ sent: boolean }> {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[notify] 未配置 SMTP，跳过发送：${input.subject} → ${input.to}`);
    return { sent: false };
  }
  await transport.sendMail({
    from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  return { sent: true };
}
