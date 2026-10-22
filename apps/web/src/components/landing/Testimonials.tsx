import type { TFn } from "./types";

const CARDS = [
  { q: "home.testi1Quote", n: "home.testi1Name", r: "home.testi1Role", initial: "W" },
  { q: "home.testi2Quote", n: "home.testi2Name", r: "home.testi2Role", initial: "P" },
  { q: "home.testi3Quote", n: "home.testi3Name", r: "home.testi3Role", initial: "C" },
];

/** 用户感想评价卡——姓名做多元美国背景（华裔/印度裔/非裔等）。 */
export function Testimonials({ t }: { t: TFn }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-[13px] font-bold uppercase tracking-wider text-[#2563EB]">
          {t("home.testiKicker")}
        </div>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight">{t("home.testiTitle")}</h2>
        <p className="mt-3 text-muted-foreground">{t("home.testiDesc")}</p>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
        {CARDS.map((c) => (
          <div key={c.n} className="rounded-xl border bg-card p-6">
            <p className="text-[15px] leading-relaxed text-slate-800">{t(c.q)}</p>
            <div className="mt-5 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                {c.initial}
              </span>
              <div>
                <div className="text-sm font-bold">{t(c.n)}</div>
                <div className="text-[12.5px] text-muted-foreground">{t(c.r)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
