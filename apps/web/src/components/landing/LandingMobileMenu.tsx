"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Item = { href: string; label: string };

/** 移动端汉堡菜单：桌面端由 LandingNav 的内联 <nav> 承载，这里只在 <md 显示。 */
export function LandingMobileMenu({
  items,
  signinLabel,
  postLabel,
}: {
  items: Item[];
  signinLabel: string;
  postLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted"
      >
        {open ? (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-16 z-50 border-b bg-background shadow-lg">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {items.map((it, i) => (
              <a
                key={i}
                href={it.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {it.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t pt-3">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-[#2563EB]"
              >
                {signinLabel}
              </Link>
              <Button asChild size="sm" className="bg-[#2563EB] hover:bg-[#1d4ed8]">
                <Link href="/employer/jobs" onClick={() => setOpen(false)}>
                  {postLabel}
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
