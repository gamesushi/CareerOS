import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { TFn } from "./types";

/** 蓝色 CTA 带。 */
export function CtaBand({ t }: { t: TFn }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20">
      <div className="rounded-3xl bg-[#2563EB] px-8 py-12 text-center text-white">
        <h2 className="text-2xl font-extrabold sm:text-3xl">{t("home.ctaTitle")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-white/90">{t("home.ctaDesc")}</p>
        <Button asChild size="lg" className="mt-6 bg-white text-[#1d4ed8] hover:bg-white/90">
          <Link href="/employer/jobs">{t("home.ctaBtn")} →</Link>
        </Button>
      </div>
    </section>
  );
}
