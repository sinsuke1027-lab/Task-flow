'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BarChart2, 
  Inbox, 
  Send, 
  Activity, 
  Settings, 
  ChevronRight,
  ShieldCheck,
  Building2,
  HelpCircle,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';

const navigation = [
  { name: 'ダッシュボード', href: '/', icon: BarChart2, roles: ['Member', 'Team Leader', 'General Manager', 'President'] },
  { name: '依頼受付・管理', href: '/inbox', icon: Inbox, roles: ['General Manager', 'Admin'] },
  { name: '新規申請・相談', href: '/request', icon: Send, roles: ['Member', 'Team Leader', 'General Manager', 'President'] },
  { name: '自分の依頼状況', href: '/tracker', icon: Activity, roles: ['Member', 'Team Leader', 'General Manager', 'President'] },
  { name: '管理者設定', href: '/admin', icon: Settings, roles: ['Admin', 'General Manager'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Filter navigation based on user position (Simple RBAC)
  const filteredNav = navigation.filter(item => {
    if (!user) return false;
    // For demo, if user is 佐藤 健二 (Admin/GM), show all.
    if (user.id === 'user_admin_1') return true;
    return item.roles.includes(user.position);
  });

  return (
    <div className="flex flex-col h-full bg-[#FBFBFA] border-r w-64 select-none animate-in slide-in-from-left-4 duration-500 fixed left-0 top-0 z-50">
      {/* Brand Logo */}
      <div className="p-6 pb-2">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-[#191714] text-white rounded-lg flex items-center justify-center font-bold text-lg transition-transform group-hover:scale-110">
            TB
          </div>
          <span className="font-bold text-lg tracking-tight text-[#191714]">Task Bridge</span>
        </Link>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-6 space-y-0.5">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">メニュー</div>
        {filteredNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold transition-all group",
                isActive 
                  ? "bg-white text-[#191714] notion-shadow border border-slate-200" 
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100/50"
              )}
            >
              <item.icon className={cn(
                "w-4 h-4 transition-colors",
                isActive ? "text-[#191714]" : "text-slate-300 group-hover:text-slate-500"
              )} />
              {item.name}
              {isActive && <ChevronRight className="w-3 h-3 ml-auto text-slate-300" />}
            </Link>
          );
        })}

        <div className="pt-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">ワークスペース</div>
        <Link 
          href="/organization"
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold transition-all group",
            pathname === '/organization' 
              ? "bg-white text-[#191714] notion-shadow border border-slate-200" 
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-100/50"
          )}
        >
          <Building2 className={cn(
            "w-4 h-4 transition-colors",
            pathname === '/organization' ? "text-[#191714]" : "text-slate-300 group-hover:text-slate-500"
          )} />
          組織図
        </Link>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 transition-all group">
          <ShieldCheck className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
          社内規定・規約
        </button>
      </nav>

      {/* Footer Nav */}
      <div className="p-3 mt-auto space-y-0.5 border-t border-slate-100/10">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 transition-all group">
          <HelpCircle className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
          サポート・ヘルプ
        </button>
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all group"
        >
          <LogOut className="w-4 h-4 text-slate-300 group-hover:text-rose-500" />
          ログアウト
        </button>
      </div>
    </div>
  );
}
