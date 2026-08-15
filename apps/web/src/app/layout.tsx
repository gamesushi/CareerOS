import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n/provider";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale } from "@/lib/i18n/server";
import { htmlLangFor } from "@/lib/i18n/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 应用自身已内置 11 种语言（右上角切换器），不需要 Chrome 自带的整页翻译。
// 浏览器翻译会改写 React 管理的文本节点，导致切换语言时 React 调和失败
// （Failed to execute 'removeChild' on 'Node' / NotFoundError）。这里显式禁用它。
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const messages = getMessages(locale);
  return {
    title: messages["app.name"],
    description: messages["app.description"],
    other: { google: "notranslate" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = getMessages(locale);
  return (
    <html
      lang={htmlLangFor(locale)}
      translate="no"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale} messages={messages}>
          {children}
        </I18nProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
