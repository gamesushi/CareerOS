import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicOrganization } from "@/lib/organizations";
import { getT, getLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

// 公开公司主页。免登录访问（middleware 的 PUBLIC_PATHS 已放行 /c），
// 范式照 app/tools/leaderboard：server component 直查 DB，不额外开 API。
// 岗位列表复用候选端同一套可见性闸门（open + approved + 未下架），见 lib/organizations.ts。
// 文案全部走 i18n（服务端 getT），不再硬编码中文，公开页随 cookie / Accept-Language 切换语言。

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicOrganization(slug);
  const t = await getT();
  if (!data) return { title: t("company.notFound") };
  return {
    title: t("company.metaTitle", { name: data.org.name }),
    description:
      data.org.description?.slice(0, 150) ??
      t("company.metaDescriptionCount", { name: data.org.name, count: data.postings.length }),
  };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicOrganization(slug);
  if (!data) notFound();
  const { org, postings } = data;
  const t = await getT();
  const locale = await getLocale();

  // orgType / category 走 i18n；若某 locale 漏翻则回退到原始值（slug），不出现中文、也不出现原始 key。
  const orgTypeLabel = (() => {
    const k = t(`orgType.${org.orgType}`);
    return k === `orgType.${org.orgType}` ? org.orgType : k;
  })();
  const catLabel = (id: string) => {
    const k = t(`category.${id}`);
    return k === `category.${id}` ? id : k;
  };

  return (
    <div className="flex min-h-full flex-col">
      {/* 全出血蓝 hero，与落地页视觉统一 */}
      <section className="relative overflow-hidden bg-[#2563EB] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_400px_at_85%_-10%,rgba(255,255,255,0.18),transparent_60%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-white/80 transition-colors hover:text-white"
          >
            ← uCareerOS
          </Link>
          <div className="mt-6 flex items-start gap-4">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- 外部任意域名 logo，不走 next/image loader
              <img
                src={org.logoUrl}
                alt={org.name}
                className="size-16 shrink-0 rounded-xl border border-white/30 bg-white/10 object-contain p-1"
              />
            ) : (
              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/10 text-2xl font-semibold">
                {org.name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="flex flex-wrap items-center gap-2 text-3xl font-extrabold tracking-tight">
                {org.name}
                {org.verified && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
                    ✓ {t("company.verified")}
                  </span>
                )}
              </h1>
              <p className="mt-2 text-sm text-white/85">
                {[orgTypeLabel, org.industry, org.size, org.location].filter(Boolean).join(" · ")}
              </p>
              {org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noreferrer nofollow"
                  className="mt-1 inline-block text-sm font-medium text-white underline-offset-2 hover:underline"
                >
                  {org.website}
                </a>
              )}
            </div>
          </div>
          {org.description && (
            <p className="mt-5 max-w-2xl whitespace-pre-wrap text-[15px] leading-relaxed text-white/90">
              {org.description}
            </p>
          )}
        </div>
      </section>

      {/* 在招职位卡片网格 */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <h2 className="text-xl font-bold tracking-tight">
          {t("company.openRoles", { count: postings.length })}
        </h2>
        {postings.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            {t("company.noOpenRoles")}
          </p>
        ) : (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {postings.map((p) => (
              <li
                key={p.id}
                className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {p.url ? (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="font-semibold hover:text-[#2563EB] hover:underline"
                    >
                      {p.title}
                    </a>
                  ) : (
                    <span className="font-semibold">{p.title}</span>
                  )}
                  {p.referralCode && (
                    <span className="rounded-full bg-[#2563EB]/10 px-2 py-0.5 text-[11px] font-semibold text-[#2563EB]">
                      {t("company.referralCode", { code: p.referralCode })}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(p.categories as string[] | null)?.map((c) => (
                    <span
                      key={c}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                    >
                      {catLabel(c)}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {[
                    [p.location, p.salary].filter(Boolean).join(" · "),
                    t("company.publishedOn", {
                      date: new Date(p.createdAt).toLocaleDateString(locale),
                    }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground/90">{p.description}</p>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="border-t bg-slate-50 py-6 text-center text-xs text-muted-foreground">
        {t("company.poweredBy")}
      </footer>
    </div>
  );
}
