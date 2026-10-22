import type { LandingPosting } from "./types";

const GRAD = [
  "bg-[linear-gradient(135deg,#2563eb,#1e40af)]",
  "bg-[linear-gradient(135deg,#7c3aed,#5b21b6)]",
  "bg-[linear-gradient(135deg,#0d9488,#0f766e)]",
];

// 无真实职位时的静态演示海报（含多元内推人姓名，呼应用户要求）。
const DEMO: LandingPosting[] = [
  {
    id: "demo-1",
    title: "Senior Frontend Engineer",
    company: "Anchor Labs",
    location: "Remote",
    salary: "$160–210K · 14 mo.",
    referralCode: null,
    categories: ["React", "Next.js", "TS"],
    orgSlug: null,
    orgName: null,
    orgVerified: false,
    posterRole: "employee_referral",
  },
  {
    id: "demo-2",
    title: "AI Product Designer",
    company: "Neura Labs",
    location: "New York",
    salary: "$140–185K",
    referralCode: null,
    categories: ["LLM", "UX", "0→1"],
    orgSlug: null,
    orgName: null,
    orgVerified: false,
    posterRole: "hiring_manager",
  },
  {
    id: "demo-3",
    title: "Head of Growth, Intl",
    company: "Orbit",
    location: "Remote",
    salary: "$190–260K · equity",
    referralCode: null,
    categories: ["GTM", "Growth"],
    orgSlug: null,
    orgName: null,
    orgVerified: false,
    posterRole: "employee_referral",
  },
];

const DEMO_REFERRERS = ["Tom Lin", "Priya Patel", "Marcus Reed"];

function PosterInner({ p, grad }: { p: LandingPosting; grad: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/50 bg-white shadow-[0_30px_60px_rgba(2,8,40,0.35)]">
      <div className={`${grad} px-[18px] py-[14px] text-white`}>
        <div className="flex items-center gap-2 text-[13px] opacity-95">
          <span className="grid size-6 place-items-center rounded-md bg-white/30 text-[12px] font-bold">
            {(p.company || p.orgName || "?").charAt(0)}
          </span>
          {p.company || p.orgName}
          {p.location ? ` · ${p.location}` : ""}
        </div>
        <div className="mt-2 text-[20px] font-extrabold leading-tight">{p.title}</div>
      </div>
      <div className="px-[18px] py-[14px]">
        {p.salary ? (
          <span className="mb-2 inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-[13px] font-bold text-emerald-700">
            {p.salary}
          </span>
        ) : null}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {p.categories.slice(0, 4).map((c) => (
            <span key={c} className="rounded-md bg-slate-100 px-2 py-0.5 text-[12px] text-slate-600">
              {c}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 pt-3 text-[12.5px] text-slate-500">
          <span className="grid size-6 place-items-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">
            ✓
          </span>
          <span>
            <span className="font-bold text-slate-900">Verified</span> referrer
            {p.referralCode ? ` · ${p.referralCode}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

/** 首屏 3D 倾斜职位海报堆（lg+）。无真实数据时用静态演示海报。 */
export function PosterStack({ postings }: { postings: LandingPosting[] }) {
  const items = postings.length >= 1 ? postings.slice(0, 3) : DEMO;
  const cls = ["p1", "p2", "p3"];
  const pos = [
    "top-[30px] left-[10px] z-30 [transform:translateZ(40px)]",
    "top-[8px] left-[150px] z-20 [transform:translateZ(0)_rotate(2deg)] opacity-95",
    "top-[64px] left-[96px] z-10 [transform:translateZ(-40px)_rotate(-3deg)] opacity-90",
  ];

  return (
    <div className="relative">
      {/* 桌面：3D 倾斜堆叠 */}
      <div className="relative hidden h-[420px] [perspective:1600px] lg:block">
        <div className="relative h-full [transform-style:preserve-3d] [transform:rotateY(-19deg)_rotateX(7deg)]">
          {items.map((p, i) => (
            <div key={p.id} className={`absolute w-[330px] ${pos[i]}`}>
              <PosterInner p={p} grad={GRAD[i % 3]} />
            </div>
          ))}
        </div>
        <div className="absolute -right-2 top-0 z-40 rounded-full bg-white px-3 py-2 text-[12.5px] font-bold text-slate-900 shadow-[0_12px_28px_rgba(2,8,40,0.25)]">
          ✓ Referrer verified
        </div>
        <div className="absolute -left-2 bottom-6 z-40 rounded-full bg-white px-3 py-2 text-[12.5px] font-bold text-slate-900 shadow-[0_12px_28px_rgba(2,8,40,0.25)]">
          💸 $2,000 on hire
        </div>
      </div>

      {/* 移动：单张海报，避免横向溢出 */}
      <div className="lg:hidden">
        <div className={GRAD[0]}>
          <PosterInner p={items[0]} grad={GRAD[0]} />
        </div>
      </div>
    </div>
  );
}
