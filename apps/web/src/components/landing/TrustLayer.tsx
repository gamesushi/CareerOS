import { ShieldCheck, Building2, Handshake } from "lucide-react";
import type { TFn } from "./types";

const FEATURES = [
  { icon: ShieldCheck, title: "home.trust1Title", desc: "home.trust1Desc" },
  { icon: Building2, title: "home.trust2Title", desc: "home.trust2Desc" },
  { icon: Handshake, title: "home.trust3Title", desc: "home.trust3Desc" },
];

/** 信任层三卡——我们的护城河（CareerHound 没有的东西）。 */
export function TrustLayer({ t }: { t: TFn }) {
  return (
    <section id="trust" className="bg-[#F4F6FB] py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-[13px] font-bold uppercase tracking-wider text-[#2563EB]">
            {t("home.trustKicker")}
          </div>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">{t("home.trustTitle")}</h2>
          <p className="mt-3 text-muted-foreground">{t("home.trustDesc")}</p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border bg-card p-6 transition-colors hover:border-[#c7d2fe] hover:shadow-[0_14px_34px_rgba(37,99,235,0.1)]"
            >
              <div className="grid size-11 place-items-center rounded-xl bg-[#eff4ff] text-[#2563EB]">
                <Icon className="size-5" />
              </div>
              <h4 className="mt-4 text-lg font-bold">{t(title)}</h4>
              <p className="mt-2 text-sm text-muted-foreground">{t(desc)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
