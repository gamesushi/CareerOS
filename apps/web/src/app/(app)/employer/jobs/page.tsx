import { redirect } from "next/navigation";
import { prisma } from "@careeros/db";
import { EMPLOYER_ROLES } from "@careeros/shared";
import { getSession } from "@/lib/auth";
import { EmployerJobs } from "./employer-jobs";

export const metadata = { title: "发布岗位 · CareerOS" };

// 雇主发岗页。页面级门控与接口级 requireRole 同源——都查 DB，
// 保证用户刚在设置页开启发岗、尚未重新登录时也能立刻进来（JWT 里的 role 是登录快照）。
export default async function EmployerJobsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!u || !EMPLOYER_ROLES.includes(u.role as (typeof EMPLOYER_ROLES)[number])) {
    redirect("/settings?employer=1"); // 引导到「成为招聘者」开关处
  }

  return <EmployerJobs />;
}
