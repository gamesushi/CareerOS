import { prisma, buildApplicationEmail, type NotifyKind } from "@careeros/db";
import { sendMail } from "../lib/mailer";

// 投递通知消费者。内容构造在 @careeros/db（可直接用 DB 测试断言），
// 这里只负责取内容 + 发信 + 记日志。
export async function handleNotifyJob(kind: NotifyKind, applicationId: string) {
  const mail = await buildApplicationEmail(prisma, kind, applicationId);
  if (!mail) {
    // 投递被删、或状态不需要通知（如候选人自己撤回）——静默跳过，不算失败
    console.log(`[notify] 跳过 ${kind}#${applicationId}（无需通知）`);
    return { sent: false, skipped: true };
  }
  const { sent } = await sendMail(mail);
  console.log(`[notify] ${kind}#${applicationId} → ${mail.to} sent=${sent}`);
  return { sent, skipped: false };
}
