import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicOrganization } from "@/lib/organizations";

export const dynamic = "force-dynamic";

// 公开公司主页。免登录访问（middleware 的 PUBLIC_PATHS 已放行 /c），
// 范式照 app/tools/leaderboard：server component 直查 DB，不额外开 API。
// 岗位列表复用候选端同一套可见性闸门（open + approved + 未下架），见 lib/organizations.ts。

const ORG_TYPE_LABEL: Record<string, string> = {
  individual_hr: "HR 个人",
  startup: "创业公司",
  non_company_team: "创业团队",
  enterprise: "企业",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicOrganization(slug);
  if (!data) return { title: "公司不存在 · CareerOS" };
  return {
    title: `${data.org.name} 招聘中的职位 · CareerOS`,
    description:
      data.org.description?.slice(0, 150) ??
      `${data.org.name}在 CareerOS 发布的 ${data.postings.length} 个在招职位。`,
  };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicOrganization(slug);
  if (!data) notFound();
  const { org, postings } = data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="flex items-start gap-4">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 外部任意域名 logo，不走 next/image loader
          <img
            src={org.logoUrl}
            alt={org.name}
            className="size-16 shrink-0 rounded-lg border object-contain"
          />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border bg-muted text-xl font-semibold text-muted-foreground">
            {org.name.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {org.name}
            {org.verified && (
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs font-normal text-emerald-600">
                已认证
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[ORG_TYPE_LABEL[org.orgType] ?? org.orgType, org.industry, org.size, org.location]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {org.website && (
            <a
              href={org.website}
              target="_blank"
              rel="noreferrer nofollow"
              className="mt-1 inline-block text-sm text-primary hover:underline"
            >
              {org.website}
            </a>
          )}
        </div>
      </header>

      {org.description && (
        <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {org.description}
        </p>
      )}

      <h2 className="mt-8 mb-3 text-sm font-medium text-muted-foreground">
        在招职位（{postings.length}）
      </h2>

      {postings.length === 0 ? (
        <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
          暂无在招职位
        </p>
      ) : (
        <ul className="space-y-2">
          {postings.map((p) => (
            <li key={p.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                {p.url ? (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer nofollow"
                    className="font-medium hover:underline"
                  >
                    {p.title}
                  </a>
                ) : (
                  <span className="font-medium">{p.title}</span>
                )}
                {(p.categories as string[] | null)?.map((c) => (
                  <span
                    key={c}
                    className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {c}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {[p.location, p.salary].filter(Boolean).join(" · ")}
                {` · 发布于 ${new Date(p.createdAt).toLocaleDateString("zh-CN")}`}
              </p>
              <p className="mt-1 line-clamp-3 text-xs text-muted-foreground/90">{p.description}</p>
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-10 border-t pt-4 text-center text-xs text-muted-foreground">
        由 <Link href="/" className="text-primary hover:underline">CareerOS</Link> 提供
      </footer>
    </div>
  );
}
