import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppContent } from "@/components/layout/app-content";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Task Bridge SaaS",
  description: "社内申請・承認ワークフロー管理プラットフォーム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={inter.className} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* スキップナビゲーションリンク（アクセシビリティ） */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:border focus:rounded-lg focus:text-sm focus:font-bold focus:shadow-lg focus:text-[#191714]"
        >
          メインコンテンツへスキップ
        </a>
        <AppContent>{children}</AppContent>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
