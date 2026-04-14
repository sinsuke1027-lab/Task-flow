'use client';

import { useState, useRef } from 'react';
import { Bell, HelpCircle, User, Search, ChevronRight, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { usePathname } from 'next/navigation';

export function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsMenuOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsMenuOpen(false);
    }, 300);
  };

  const getBreadcrumb = () => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return 'ダッシュボード';
    
    const mapping: Record<string, string> = {
      'inbox': '依頼受付・管理',
      'request': '新規申請・相談',
      'tracker': '自分の依頼状況',
      'admin': '管理者設定',
      'login': 'ログイン'
    };

    return parts.map(p => mapping[p] || p).join(' / ');
  };

  const getRoleLabel = (role?: string) => {
    const roleMapping: Record<string, string> = {
      'President': '代表取締役',
      'Division Manager': '事業部長',
      'General Manager': '部長 / GM',
      'Team Leader': 'チームリーダー',
      'Member': '一般社員',
    };
    return roleMapping[role || ''] || role || 'ゲスト';
  };

  return (
    <header className="h-14 border-b bg-white/70 backdrop-blur-xl sticky top-0 z-40 flex items-center justify-between px-8">
      <div className="flex items-center gap-3 text-xs font-bold tracking-tight">
        <span className="text-slate-300">Task Flow</span>
        <ChevronRight className="w-3 h-3 text-slate-200" />
        <span className="text-[#191714] bg-slate-50 px-2 py-1 rounded border shadow-sm">{getBreadcrumb()}</span>
      </div>

      <div className="flex items-center gap-5">
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border rounded-lg text-slate-400 group hover:border-slate-300 transition-all cursor-pointer">
          <Search className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">検索...</span>
          <span className="ml-8 text-[10px] bg-white border px-1 rounded shadow-sm">⌘K</span>
        </div>

        <div className="flex items-center gap-1">
          <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500 relative">
            <Bell className="w-4 h-4" />
            <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full border border-white" />
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
        
        <div 
          className="flex items-center gap-3 pl-5 border-l ml-2 relative"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="text-right flex flex-col justify-center cursor-pointer">
            <div className="text-xs font-bold text-[#191714]">{user?.name || '読み込み中...'}</div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{getRoleLabel(user?.position)}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-100 border overflow-hidden p-0.5 ring-2 ring-transparent hover:ring-slate-100 transition-all cursor-pointer">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <div className="w-full h-full bg-slate-200 flex items-center justify-center rounded-full">
                <User className="w-4 h-4 text-slate-400" />
              </div>
            )}
          </div>

          {/* Quick Dropdown with Delay Logic */}
          <div 
            className={`absolute top-full right-0 mt-2 w-48 bg-white border rounded-xl shadow-2xl p-1 transition-all transform origin-top-right ${
              isMenuOpen 
                ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" 
                : "opacity-0 -translate-y-2 scale-95 pointer-events-none"
            }`}
          >
            {/* Transparent bridge to prevent mouse-out in the gap */}
            <div className="absolute -top-2 left-0 w-full h-2 bg-transparent" />
            
            <div className="px-3 py-2 border-b mb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">アカウント</p>
            </div>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
              <User className="w-3.5 h-3.5 text-slate-400" />
              プロフィール設定
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              環境設定
            </button>
            <div className="my-1 border-t" />
            <button 
              onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              ログアウト
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
