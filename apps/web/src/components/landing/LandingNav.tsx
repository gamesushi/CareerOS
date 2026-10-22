import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { TFn } from "./types";

/** 落地页导航：logo + 锚点/路由链接 + 语言切换 + 登录/发岗。 */
export function LandingNav({ t }: { t: TFn }) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" aria-label="uCareerOS" className="flex items-center">
          <img src="/logo.png" alt="uCareerOS" className="h-8 w-auto" />
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          <a href="#referred" className="transition-colors hover:text-foreground">
            {t("home.navReferred")}
          </a>
          <a href="#trust" className="transition-colors hover:text-foreground">
            {t("home.navCompany")}
          </a>
          <a href="#trust" className="transition-colors hover:text-foreground">
            {t("home.navTrust")}
          </a>
          <a href="#trust" className="transition-colors hover:text-foreground">
            {t("home.navRewards")}
          </a>
          <a href="#faq" className="transition-colors hover:text-foreground">
            {t("home.navPricing")}
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher className="h-9 w-auto" />
          <Link href="/login" className="hidden text-sm font-semibold text-[#2563EB] sm:block">
            {t("home.navSignin")}
          </Link>
          <Button asChild size="sm" className="bg-[#2563EB] hover:bg-[#1d4ed8]">
            <Link href="/employer/jobs">{t("home.navPost")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
