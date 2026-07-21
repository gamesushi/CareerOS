"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ReactFlow, Background, Controls, Position, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

type GraphData = {
  nodes: { id: string; type: string; label: string; meta?: Record<string, unknown> }[];
  edges: { from: string; to: string; rel: string }[];
};

// 分层布局：user → 经历 → 项目 → 技能/成果 四列，按列内序号排 y
const COLUMN_X: Record<string, number> = { user: 0, experience: 260, project: 540, skill: 820, achievement: 820 };
const NODE_STYLE: Record<string, React.CSSProperties> = {
  user: { background: "#1a1a1a", color: "#fff", fontWeight: 600, borderRadius: 20, padding: "10px 18px" },
  experience: { background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 8 },
  project: { background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8 },
  skill: { background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 16, fontSize: 12 },
  achievement: { background: "#fdf2f8", border: "1px solid #fbcfe8", borderRadius: 8, fontSize: 12 },
};

export default function CareerGraphPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const t = useT();

  useEffect(() => {
    void api<GraphData>("/career/graph").then((res) => res && setData(res));
  }, []);

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [] as Node[], edges: [] as Edge[] };
    const counters: Record<string, number> = {};
    // 技能/成果共列，交错排布
    const columnKey = (t: string) => (t === "achievement" ? "skill" : t);

    const nodes: Node[] = data.nodes.map((n) => {
      const col = columnKey(n.type);
      const idx = (counters[col] = (counters[col] ?? 0) + 1);
      return {
        id: n.id,
        position: { x: COLUMN_X[n.type] ?? 0, y: n.type === "user" ? 200 : idx * 64 },
        data: { label: n.type === "skill" && n.meta?.level ? `${n.label} · ${n.meta.level}` : n.label },
        style: { ...NODE_STYLE[n.type], padding: NODE_STYLE[n.type]?.padding ?? "6px 12px" },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    const edges: Edge[] = data.edges.map((e, i) => ({
      id: `e${i}`,
      source: e.from,
      target: e.to,
      label: undefined,
      animated: e.rel === "WORKED_AT",
      style: { stroke: e.rel === "EVIDENCED_BY" ? "#fbbf24" : "#cbd5e1" },
    }));
    return { nodes, edges };
  }, [data]);

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("graph.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("graph.subtitle")}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/knowledge"><ArrowLeft className="size-4" /> {t("graph.back")}</Link>
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-background">
        {!data ? (
          <Skeleton className="h-full" />
        ) : (
          <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
            <Background gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
