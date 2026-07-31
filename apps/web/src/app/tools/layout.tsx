import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "免费求职工具 · CareerOS",
  description:
    "CareerOS 免费公开工具：简历↔JD 关键词匹配器、幽灵岗/诈骗招聘检测。纯前端、零上传、保护隐私。",
};

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/tools" className="font-semibold">
            CareerOS 工具
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/tools/matcher" className="hover:text-foreground">
              关键词匹配
            </Link>
            <Link href="/tools/scam-checker" className="hover:text-foreground">
              诈骗检测
            </Link>
            <Link href="/" className="hover:text-foreground">
              进入应用
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        CareerOS · 免费工具 · 数据仅在本机处理，不会上传服务器
      </footer>
    </div>
  );
}
