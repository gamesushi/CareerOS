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
                {t("company.verified")}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[orgTypeLabel, org.industry, org.size, org.location].filter(Boolean).join(" · ")}
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
        {t("company.openRoles", { count: postings.length })}
      </h2>

      {postings.length === 0 ? (
        <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
          {t("company.noOpenRoles")}
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
                    {catLabel(c)}
                  </span>
                ))}
                {p.referralCode && (
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                    {t("company.referralCode", { code: p.referralCode })}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {[
                  [p.location, p.salary].filter(Boolean).join(" · "),
                  t("company.publishedOn", {
                    date: new Date(p.createdAt).toLocaleDateString(locale),
                  }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-1 line-clamp-3 text-xs text-muted-foreground/90">{p.description}</p>
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-10 border-t pt-4 text-center text-xs text-muted-foreground">
        {t("company.poweredBy")}
      </footer>
    </div>
  );
}
