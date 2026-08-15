import type { PrismaClient } from "@prisma/client";

// 投递通知的**内容构造**。刻意只负责「查数据 → 拼邮件」，不负责发送——
// 发送要 nodemailer，放这里会给 @careeros/db 平白加一个依赖；真正的 transport 在
// apps/worker/src/lib/mailer.ts（worker 是唯一的发送方，web 侧只入队）。
// 这样切分的另一个好处：内容可以直接用 DB 集成测试断言，不必去 mock SMTP。

export type NotifyKind = "application_submitted" | "application_status_changed";

export interface NotifyEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const STATUS_LABEL: Record<string, string> = {
  submitted: "已投递",
  screening: "进入筛选",
  interview: "进入面试",
  offer: "已发 Offer",
  rejected: "未通过",
  withdrawn: "已撤回",
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function wrap(title: string, lines: string[], cta?: { label: string; url: string }): string {
  const body = lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join("");
  const button = cta
    ? `<p style="margin:20px 0 0"><a href="${esc(cta.url)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${esc(cta.label)}</a></p>`
    : "";
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;color:#111;max-width:520px">
<h2 style="font-size:16px;margin:0 0 16px">${esc(title)}</h2>${body}${button}
<p style="margin:24px 0 0;font-size:12px;color:#888">此邮件由 uCareerOS 自动发送，请勿直接回复。</p></div>`;
}

/**
 * 构造某条投递的通知邮件。返回 null 表示不该发（数据已删、状态不需要通知等），
 * 调用方据此静默跳过而不是报错。
 */
export async function buildApplicationEmail(
  prisma: PrismaClient,
  kind: NotifyKind,
  applicationId: string,
  appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3010",
): Promise<NotifyEmail | null> {
  const app = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      jobPostingId: true,
      candidate: { select: { name: true, email: true } },
      jobPosting: {
        select: {
          title: true,
          company: true,
          postedBy: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!app) return null;

  const job = `${app.jobPosting.company} · ${app.jobPosting.title}`;

  if (kind === "application_submitted") {
    const to = app.jobPosting.postedBy.email;
    if (!to) return null;
    const url = `${appBaseUrl}/employer/jobs/${app.jobPostingId}/applications`;
    const who = app.candidate.name || app.candidate.email;
    return {
      to,
      subject: `新投递：${job}`,
      text: `${who} 投递了「${job}」。\n查看投递：${url}`,
      html: wrap("你收到一份新投递", [`${who} 投递了「${job}」。`], { label: "查看投递", url }),
    };
  }

  // 状态变更通知候选人。撤回是候选人自己的动作，不必再通知他本人。
  if (app.status === "withdrawn") return null;
  const to = app.candidate.email;
  if (!to) return null;
  const label = STATUS_LABEL[app.status] ?? app.status;
  const url = `${appBaseUrl}/jobs/active`;
  return {
    to,
    subject: `投递状态更新：${job} — ${label}`,
    text: `你投递的「${job}」状态更新为：${label}。\n查看：${url}`,
    html: wrap("投递状态更新", [`你投递的「${job}」状态更新为：${label}。`], {
      label: "查看我的投递",
      url,
    }),
  };
}
