'use client';

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { SidebarProvider, useSidebar } from "@/context/sidebar-context";

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const { isOpen, close } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (!isLoading && !user && !isLoginPage) {
      router.push('/login');
    }
  }, [isLoading, user, isLoginPage, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-400 animate-pulse">LOADING TASK BRIDGE...</p>
        </div>
      </div>
    );
  }

  if (!user && !isLoginPage) {
    return null;
  }

  if (isLoginPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex min-h-screen">
      {/* モバイル: サイドバー開時のオーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}
      <Sidebar />
      <div className="flex-1 md:ml-64 flex flex-col min-w-0">
        <Header />
        <main id="main-content" className="flex-1 bg-white p-4 md:p-8" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function AppContent({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <AppShell>{children}</AppShell>
      </SidebarProvider>
    </AuthProvider>
  );
}
