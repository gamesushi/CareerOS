import { Check, X } from "lucide-react";
import type { TFn } from "./types";

/** 传统平台 vs uCareerOS 对比（红✕ / 深色绿✓）。 */
export function Comparison({ t }: { t: TFn }) {
  const trad = [t("home.cmpTrad1"), t("home.cmpTrad2"), t("home.cmpTrad3"), t("home.cmpTrad4")];
  const us = [t("home.cmpUs1"), t("home.cmpUs2"), t("home.cmpUs3"), t("home.cmpUs4")];

  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight">{t("home.cmpTitle")}</h2>
        <p className="mt-3 text-muted-foreground">{t("home.cmpSub")}</p>
      </div>
      <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-7">
          <h3 className="text-xl font-extrabold">{t("home.cmpTradTitle")}</h3>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">{t("home.cmpTradSub")}</p>
          <ul className="space-y-3.5">
            {trad.map((item) => (
              <li key={item} className="flex gap-3 text-[15px]">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
                  <X className="size-3.5" strokeWidth={3} />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-[#090E34] p-7 text-white">
          <h3 className="text-xl font-extrabold">{t("home.cmpUsTitle")}</h3>
          <p className="mb-5 mt-1 text-sm text-white/70">{t("home.cmpUsSub")}</p>
          <ul className="space-y-3.5">
            {us.map((item) => (
              <li key={item} className="flex gap-3 text-[15px]">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
