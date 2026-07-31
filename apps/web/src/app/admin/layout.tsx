import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@careeros/db";
import { isActiveAdmin } from "@/lib/api";
import { AdminSidebar } from "@/components/admin-sidebar";
import { EmailVerificationGate } from "@/components/email-verification-gate";

// Admin 后台第二层门禁（第一层是 middleware 的登录 gate，第三层是各 /api/admin 路由的 requireAdmin）。
// 角色一律以 DB 为准：管理员被降权后即时失去后台访问，无需等 JWT 过期。
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (!(await isActiveAdmin(session.user.id))) redirect("/dashboard");

  // 邮箱验证硬拦截：未验证邮箱的管理员同样进不去后台（与 (app) 区域一致）。
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });
  if (!u?.emailVerified) {
    return <EmailVerificationGate email={session.user.email ?? ""} />;
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={session.user.email ?? ""} />
      <main className="min-w-0 flex-1 bg-muted/20 px-8 py-6">{children}</main>
    </div>
  );
}
