import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PosterStack } from "./PosterStack";
import type { LandingPosting, TFn } from "./types";

const AVATARS = ["L", "P", "S", "M"];

/** 全出血蓝色 hero：反常识主张 + 数据化社会证明 + 3D 职位海报主视觉。 */
export function Hero({
  t,
  postings,
  jobs,
  companies,
}: {
  t: TFn;
  postings: LandingPosting[];
  jobs: number;
  companies: number;
}) {
  return (
    <section className="relative overflow-hidden bg-[#2563EB] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_400px_at_80%_-10%,rgba(255,255,255,0.18),transparent_60%)]" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-semibold">
            ● {t("home.heroEyebrow")}
          </span>
          <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl">
            {t("home.heroTitle")}
          </h1>
          <p className="mt-4 max-w-xl text-[18px] leading-relaxed text-white/90">
            {t("home.heroDesc")}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-white text-[#1d4ed8] hover:bg-white/90">
              <a href="#referred">{t("home.heroPrimary")} →</a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20"
            >
              <Link href="/employer/jobs">{t("home.heroSecondary")}</Link>
            </Button>
          </div>
          <div className="mt-8 flex items-center gap-3">
            <div className="flex">
              {AVATARS.map((a, i) => (
                <span
                  key={a}
                  className="grid size-9 place-items-center rounded-full border-2 border-[#2563EB] bg-slate-200 text-[12px] font-bold text-slate-600"
                  style={{ marginLeft: i === 0 ? 0 : -10 }}
                >
                  {a}
                </span>
              ))}
              <span className="grid size-9 place-items-center rounded-full border-2 border-[#2563EB] bg-white/20 text-[12px] font-bold">
                +
              </span>
            </div>
            <div className="text-[14px] text-white/90">
              <span className="text-yellow-300">★★★★★</span>
              <br />
              <span className="font-bold">{t("home.heroProof", { jobs, companies })}</span>
            </div>
          </div>
        </div>
        <PosterStack postings={postings} />
      </div>
    </section>
  );
}
