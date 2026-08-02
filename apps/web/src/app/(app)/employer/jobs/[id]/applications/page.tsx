import { redirect, notFound } from "next/navigation";
import { prisma } from "@careeros/db";
import { EMPLOYER_ROLES } from "@careeros/shared";
import { getSession } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { listApplicationsForPosting, requireEmployerOnPosting } from "@/lib/job-applications";
import { ApplicationInbox } from "./inbox";

export const metadata = { title: "投递 · CareerOS" };
export const dynamic = "force-dynamic";

// 雇主收件箱。授权走与接口同一个 requireEmployerOnPosting——
// 岗位发布者本人或其组织成员，其他人（哪怕知道岗位 id）一律 403。
export default async function ApplicationsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;

  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!u || !EMPLOYER_ROLES.includes(u.role as (typeof EMPLOYER_ROLES)[number])) {
    redirect("/settings?employer=1");
  }

  try {
    const posting = await requireEmployerOnPosting(id, session.user.id);
    const applications = await listApplicationsForPosting(id);
    return (
      <ApplicationInbox
        posting={{ id: posting.id, title: posting.title, company: posting.company }}
        initial={applications.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))}
      />
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) redirect("/employer/jobs");
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}
