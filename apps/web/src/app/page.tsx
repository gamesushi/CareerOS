import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { listPublicPostings } from "@/lib/job-postings";
import { getPublicStats } from "@/lib/stats";
import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { Comparison } from "@/components/landing/Comparison";
import { TrustLayer } from "@/components/landing/TrustLayer";
import { Testimonials } from "@/components/landing/Testimonials";
import { PosterShowcase } from "@/components/landing/PosterShowcase";
import { CtaBand } from "@/components/landing/CtaBand";
import { Faq } from "@/components/landing/Faq";
import { SiteFooter } from "@/components/landing/SiteFooter";
import type { LandingPosting } from "@/components/landing/types";

export const metadata: Metadata = {
  title: "uCareerOS · Referred roles from real referrers",
  description:
    "uCareerOS turns startup openings into shareable posters that go straight to verified referrers. Trust-layer backing, referral rewards — no more black-hole applications.",
};

// 公开展示页：统计与职位池每小时重新聚合一次（ISR），兼顾"最新"与数据库压力。
export const revalidate = 3600;

export default async function HomePage() {
  const t = await getT();
  const [postings, stats] = await Promise.all([listPublicPostings(200), getPublicStats()]);

  const mapped: LandingPosting[] = postings.map((p) => ({
    id: p.id,
    title: p.title,
    company: p.company,
    location: p.location,
    salary: p.salary,
    referralCode: p.referralCode,
    categories: Array.isArray(p.categories) ? (p.categories as string[]) : [],
    orgSlug: p.org?.slug ?? null,
    orgName: p.org?.name ?? null,
    orgVerified: p.org?.verified ?? false,
    posterRole: p.posterRole,
  }));

  return (
    <div className="flex min-h-full flex-col">
      <LandingNav t={t} />
      <main className="flex-1">
        <Hero t={t} postings={mapped} jobs={stats.jobs} companies={stats.companies} />
        <Comparison t={t} />
        <TrustLayer t={t} />
        <Testimonials t={t} />
        <PosterShowcase t={t} postings={mapped} />
        <CtaBand t={t} />
        <Faq t={t} />
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
