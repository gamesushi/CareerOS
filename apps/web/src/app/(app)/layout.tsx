import { redirect } from "next/navigation";
import { prisma } from "@careeros/db";
import { getSession } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { TosGate } from "@/components/tos-gate";
import { BannedScreen } from "@/components/banned-screen";
import { EmailVerificationGate } from "@/components/email-verification-gate";
import { CURRENT_TOS_VERSION } from "@/lib/tos";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  // 每次导航都从 DB 取权威状态：封禁 / 软删 / 角色 / 条款版本。
  // 管理员被降权（admin→user）后无需重新登录，侧边栏与管理入口即时同步。
  const u = session.user.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, bannedAt: true, deletedAt: true, tosVersion: true, emailVerified: true },
      })
    : null;

  // 软删兜底（数据层 requireUser 已挡，这里避免进空壳）
  if (u?.deletedAt) redirect("/login");

  // 封禁拦截：被封用户直接看封禁页，避免「进 UI 壳但 API 全 403」的不一致体验。
  if (u?.bannedAt) {
    return <BannedScreen email={session.user.email ?? ""} bannedAt={u.bannedAt} />;
  }

  // 邮箱验证硬拦截：已登录但未验证邮箱的用户被挡在应用之外，必须先验证才能使用任何功能。
  // 与封禁拦截一致以 DB 取权威值；用户点击验证邮件链接后 emailVerified 落库，下次导航即放行。
  if (u && !u.emailVerified) {
    return <EmailVerificationGate email={session.user.email ?? ""} />;
  }

  // 条款同意闸门：版本不一致（从未同意 / 条款已更新）时阻断使用，要求确认。
  // 留痕在 users.tos_accepted_at / tos_version。
  let tosOk = true;
  let tosIsUpdate = false;
  if (u && u.tosVersion !== CURRENT_TOS_VERSION) {
    tosOk = false;
    tosIsUpdate = u.tosVersion !== null; // 曾同意过旧版 → 文案提示「条款已更新」
  }

  // 角色以 DB 为准（修复 JWT role 滞后），即时同步侧边栏与管理入口。
  const isAdmin = u?.role === "admin";

  return (
    <div data-app-shell className="flex min-h-screen">
      <AppSidebar
        userName={session.user.name ?? ""}
        userEmail={session.user.email ?? ""}
        isAdmin={isAdmin}
      />
      <main className="min-w-0 flex-1 bg-muted/20 px-8 py-6">{children}</main>
      {!tosOk && <TosGate isUpdate={tosIsUpdate} />}
    </div>
  );
}
