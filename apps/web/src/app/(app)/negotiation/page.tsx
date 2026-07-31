"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Handshake } from "lucide-react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

const PRIORITIES = [
  { key: "base", label: "negotiation.p.base" },
  { key: "annual", label: "negotiation.p.annual" },
  { key: "signon", label: "negotiation.p.signon" },
  { key: "equity", label: "negotiation.p.equity" },
  { key: "start", label: "negotiation.p.start" },
  { key: "level", label: "negotiation.p.level" },
  { key: "location", label: "negotiation.p.location" },
] as const;

export default function NegotiationPage() {
  const t = useT();
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [offer, setOffer] = useState("");
  const [competing, setCompeting] = useState("");
  const [priorities, setPriorities] = useState<string[]>([]);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  function togglePriority(k: string) {
    setPriorities((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  }

  async function generate() {
    if (!role.trim()) {
      toast.error(t("negotiation.roleRequired"));
      return;
    }
    setBusy(true);
    const r = await api<{ data: { content: string; model: string } }>("/negotiation/generate", {
      method: "POST",
      body: JSON.stringify({
        role: role.trim(),
        company: company.trim() || undefined,
        offer: offer.trim() || undefined,
        competing: competing.trim() || undefined,
        priorities,
      }),
    });
    setBusy(false);
    if (r) setResult(r.data.content);
  }

  async function copy() {
    await navigator.clipboard.writeText(result);
    toast.success(t("common.copied"));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("negotiation.title")}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("negotiation.desc")}</p>
        <p className="mt-1 text-xs text-muted-foreground/70">{t("negotiation.privacy")}</p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">{t("negotiation.roleReq")}</p>
              <input value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("negotiation.rolePh")} className="w-full rounded-md border bg-background px-2.5 py-2 text-sm" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">{t("negotiation.company")}</p>
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t("negotiation.companyPh")} className="w-full rounded-md border bg-background px-2.5 py-2 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">{t("negotiation.offer")}</p>
            <textarea value={offer} onChange={(e) => setOffer(e.target.value)} rows={4} placeholder={t("negotiation.offerPh")} className="w-full rounded-md border bg-background px-2.5 py-2 text-sm" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">{t("negotiation.competing")}</p>
            <textarea value={competing} onChange={(e) => setCompeting(e.target.value)} rows={2} placeholder={t("negotiation.competingPh")} className="w-full rounded-md border bg-background px-2.5 py-2 text-sm" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">{t("negotiation.priorities")}</p>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => {
                const on = priorities.includes(p.key);
                return (
                  <button
                    key={p.key}
                    onClick={() => togglePriority(p.key)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${on ? "border-primary bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
                  >
                    {t(p.label)}
                  </button>
                );
              })}
            </div>
          </div>
          <Button disabled={busy} onClick={generate}>
            <Handshake className="size-4" /> {busy ? t("common.generating") : result ? t("common.regenerate") : t("negotiation.generate")}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t("negotiation.result")}</p>
            {result && <Button size="sm" variant="outline" onClick={copy}><Copy className="size-3.5" /> {t("common.copy")}</Button>}
          </div>
          <textarea
            value={result}
            onChange={(e) => setResult(e.target.value)}
            rows={22}
            placeholder={busy ? t("negotiation.writingPh") : t("negotiation.resultPh")}
            className="w-full rounded-md border bg-background px-3 py-2.5 text-sm leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}
