import type { TFn } from "./types";

const ITEMS = [
  { q: "home.faq1Q", a: "home.faq1A" },
  { q: "home.faq2Q", a: "home.faq2A" },
  { q: "home.faq3Q", a: "home.faq3A" },
  { q: "home.faq4Q", a: "home.faq4A" },
];

/** FAQ 手风琴（原生 details，无需客户端 JS）。 */
export function Faq({ t }: { t: TFn }) {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20">
      <h2 className="mb-8 text-center text-3xl font-extrabold tracking-tight">{t("home.faqTitle")}</h2>
      <div className="space-y-3">
        {ITEMS.map((it, i) => (
          <details
            key={it.q}
            open={i === 0}
            className="group rounded-xl border bg-card [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between p-5 text-[15.5px] font-semibold">
              {t(it.q)}
              <span className="text-xl font-bold text-[#2563EB] transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="px-5 pb-5 text-[14.5px] text-muted-foreground">{t(it.a)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
