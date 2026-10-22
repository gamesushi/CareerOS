import Link from "next/link";
import type { TFn } from "./types";

/** 深色页脚。 */
export function SiteFooter({ t }: { t: TFn }) {
  return (
    <footer className="bg-[#090E34] px-4 py-14 text-[#cbd5e1]">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 text-white">
            <img src="/logo.png" alt="uCareerOS" className="h-7 w-auto" />
            <span className="text-lg font-extrabold">uCareerOS</span>
          </div>
          <p className="mt-3 max-w-[280px] text-[13px] text-[#a5b4cf]">{t("home.footerDesc")}</p>
        </div>
        <div>
          <h5 className="text-sm font-bold text-white">{t("home.footerProduct")}</h5>
          <a className="mt-3 block text-[13.5px] text-[#a5b4cf] hover:text-white" href="#referred">
            {t("home.footerReferred")}
          </a>
          <Link className="mt-2 block text-[13.5px] text-[#a5b4cf] hover:text-white" href="/employer/jobs">
            {t("home.footerPost")}
          </Link>
          <a className="mt-2 block text-[13.5px] text-[#a5b4cf] hover:text-white" href="#trust">
            {t("home.footerCompanyPages")}
          </a>
          <a className="mt-2 block text-[13.5px] text-[#a5b4cf] hover:text-white" href="#trust">
            {t("home.footerRewards")}
          </a>
        </div>
        <div>
          <h5 className="text-sm font-bold text-white">{t("home.footerResources")}</h5>
          <a className="mt-3 block text-[13.5px] text-[#a5b4cf] hover:text-white" href="#trust">
            {t("home.footerTrust")}
          </a>
          <a className="mt-2 block text-[13.5px] text-[#a5b4cf] hover:text-white" href="#faq">
            {t("home.footerHelp")}
          </a>
          <Link className="mt-2 block text-[13.5px] text-[#a5b4cf] hover:text-white" href="/login">
            {t("home.footerApi")}
          </Link>
          <a className="mt-2 block text-[13.5px] text-[#a5b4cf] hover:text-white" href="#faq">
            {t("home.footerStatus")}
          </a>
        </div>
        <div>
          <h5 className="text-sm font-bold text-white">{t("home.footerCompany")}</h5>
          <Link className="mt-3 block text-[13.5px] text-[#a5b4cf] hover:text-white" href="/login">
            {t("home.footerAbout")}
          </Link>
          <a className="mt-2 block text-[13.5px] text-[#a5b4cf] hover:text-white" href="#faq">
            {t("home.footerBlog")}
          </a>
          <Link className="mt-2 block text-[13.5px] text-[#a5b4cf] hover:text-white" href="/login">
            {t("home.footerCareers")}
          </Link>
          <Link className="mt-2 block text-[13.5px] text-[#a5b4cf] hover:text-white" href="/login">
            {t("home.footerContact")}
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-[12.5px] text-[#7c8db5]">
        <span>{t("home.footerCopyright")}</span>
        <span className="space-x-4">
          <Link href="/terms" className="hover:text-white">
            {t("home.footerTerms")}
          </Link>
          <Link href="/privacy" className="hover:text-white">
            {t("home.footerPrivacy")}
          </Link>
          <a href="#trust" className="hover:text-white">
            {t("home.footerTrustSafety")}
          </a>
        </span>
      </div>
    </footer>
  );
}
