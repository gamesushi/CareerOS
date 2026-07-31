import { listFlags } from "@/lib/admin/flags";
import { FlagManager } from "@/components/admin/flag-manager";

export const dynamic = "force-dynamic";

export default async function AdminFlagsPage() {
  const flags = await listFlags();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">灰度开关</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Feature Flag：启用为前提，放量比例按用户稳定哈希分桶。运行时用 <code className="rounded bg-muted px-1">isFeatureEnabled(key, userId)</code> 判定，改动即时生效、可回滚。
        </p>
      </header>
      <FlagManager
        flags={flags.map((f) => ({ id: f.id, key: f.key, description: f.description, enabled: f.enabled, rolloutPercent: f.rolloutPercent }))}
      />
    </div>
  );
}
