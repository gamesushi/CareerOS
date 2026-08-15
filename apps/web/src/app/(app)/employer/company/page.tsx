import { redirect } from "next/navigation";
import { prisma } from "@careeros/db";
import { EMPLOYER_ROLES } from "@careeros/shared";
import { getSession } from "@/lib/auth";
import { listMyOrganizations } from "@/lib/organizations";
import { CompanyForm } from "./company-form";

export const metadata = { title: "公司资料 · uCareerOS" };
export const dynamic = "force-dynamic";

// 公司资料页。门控与 /employer/jobs 同源——查 DB，不读 JWT 里的 role 快照。
export default async function EmployerCompanyPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!u || !EMPLOYER_ROLES.includes(u.role as (typeof EMPLOYER_ROLES)[number])) {
    redirect("/settings?employer=1");
  }

  const [orgs, existingCompanies] = await Promise.all([
    listMyOrganizations(session.user.id),
    prisma.discoveredJob.findMany({
      where: { userId: session.user.id, company: { not: null } },
      select: { company: true },
      distinct: ["company"],
      orderBy: { company: "asc" },
      take: 50,
    }),
  ]);

  // 过滤掉猎聘等来源返回的匿名展示名（如"某上海互联网上市公司"），这类名对一键导入无意义。
  const realCompanies = existingCompanies
    .map((c) => c.company!)
    .filter((c) => !!c && !c.startsWith("某"));

  return (
    <CompanyForm
      initial={orgs[0] ?? null}
      existingCompanies={realCompanies}
    />
  );
}
