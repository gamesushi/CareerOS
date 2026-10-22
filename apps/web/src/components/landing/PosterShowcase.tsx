import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { LandingPosting, TFn } from "./types";

const GRAD = [
  "bg-[linear-gradient(135deg,#2563eb,#1e40af)]",
  "bg-[linear-gradient(135deg,#7c3aed,#5b21b6)]",
  "bg-[linear-gradient(135deg,#0d9488,#0f766e)]",
  "bg-[linear-gradient(135deg,#db2777,#9d174d)]",
  "bg-[linear-gradient(135deg,#ea580c,#9a3412)]",
  "bg-[linear-gradient(135deg,#2563eb,#0e7490)]",
];

/** 英文优先 + 软去重：首轮按公司取唯一，不足 n 张再用重复公司补满，保证网格饱满。 */
const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;
function curate(postings: LandingPosting[], n: number): LandingPosting[] {
  const ordered = [...postings].sort((a, b) => {
    const ca = CJK.test(a.title) ? 1 : 0;
    const cb = CJK.test(b.title) ? 1 : 0;
    return ca - cb;
  });
  const seen = new Set<string>();
  const unique: LandingPosting[] = [];
  for (const p of ordered) {
    if (unique.length === n) break;
    const key = (p.company || p.orgName || p.title).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }
  if (unique.length >= n) return unique;
  const picked = new Set(unique.map((p) => p.id));
  for (const p of ordered) {
    if (unique.length === n) break;
    if (picked.has(p.id)) continue;
    unique.push(p);
  }
  return unique;
}

/** 真实职位海报展示网格（接 listPublicPostings）。 */
export function PosterShowcase({ t, postings }: { t: TFn; postings: LandingPosting[] }) {
  const shown = curate(postings, 6);

  return (
    <section id="referred" className="mx-auto max-w-6xl px-4 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-[13px] font-bold uppercase tracking-wider text-[#2563EB]">
          {t("home.showcaseKicker")}
        </div>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight">{t("home.showcaseTitle")}</h2>
        <p className="mt-3 text-muted-foreground">{t("home.showcaseDesc")}</p>
      </div>

      {shown.length === 0 ? (
        <div className="mx-auto mt-10 max-w-md rounded-xl border border-dashed bg-card p-8 text-center">
          <p className="text-muted-foreground">{t("home.showcaseEmpty")}</p>
          <Button asChild className="mt-4 bg-[#2563EB] hover:bg-[#1d4ed8]">
            <Link href="/employer/jobs">{t("home.navPost")}</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p, i) => {
            const href = p.orgSlug ? `/c/${p.orgSlug}` : "/login";
            return (
              <Link
                key={p.id}
                href={href}
                className="group overflow-hidden rounded-2xl border bg-card transition-transform hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(2,8,40,0.12)]"
              >
                <div className={`${GRAD[i % GRAD.length]} flex h-[118px] flex-col justify-between p-4 text-white`}>
                  <div className="text-[17px] font-extrabold leading-tight">{p.title}</div>
                  <div className="text-[12.5px] opacity-90">
                    {p.company || p.orgName}
                    {p.location ? ` · ${p.location}` : ""}
                  </div>
                </div>
                <div className="p-4">
                  {p.salary ? (
                    <div className="text-sm font-bold text-emerald-700">{p.salary}</div>
                  ) : (
                    <div className="text-sm font-semibold text-slate-400">—</div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.categories.slice(0, 4).map((c) => (
                      <span key={c} className="rounded-md bg-slate-100 px-2 py-0.5 text-[12px] text-slate-600">
                        {c}
                      </span>
                    ))}
                  </div>
                  {p.referralCode ? (
                    <div className="mt-3 inline-block rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-700">
                      {t("home.showcaseReferral", { code: p.referralCode })}
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
