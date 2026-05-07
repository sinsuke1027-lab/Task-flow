'use client';

import { useState, useRef } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import Image from 'next/image';
import { Bell, HelpCircle, User, Search, ChevronRight, LogOut, Settings, X, BookOpen, MessageCircle, Menu } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useSidebar } from '@/context/sidebar-context';
import { usePathname, useRouter } from 'next/navigation';

export function Header() {
  const { user, logout } = useAuth();
  const { toggle: toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const helpModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(helpModalRef, showHelpModal, () => setShowHelpModal(false));

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
      'organization': '組織図',
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
    <>
      <header className="h-14 border-b bg-white/70 backdrop-blur-xl sticky top-0 z-40 flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-2 md:gap-3 text-xs font-bold tracking-tight">
          {/* ハンバーガーメニュー（モバイルのみ） */}
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 -ml-1 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
            aria-label="メニューを開く"
          >
            <Menu className="w-4 h-4" />
          </button>
          <span className="hidden sm:inline text-slate-500">Task Flow</span>
          <ChevronRight className="hidden sm:block w-3 h-3 text-slate-200" />
          <span className="text-[#191714] bg-slate-50 px-2 py-1 rounded border shadow-sm">{getBreadcrumb()}</span>
        </div>

        <div className="flex items-center gap-5">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border rounded-lg text-slate-500 group hover:border-slate-300 transition-all cursor-pointer">
            <Search className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">検索...</span>
            <span className="ml-8 text-[10px] bg-white border px-1 rounded shadow-sm">⌘K</span>
          </div>

          <div className="flex items-center gap-1 relative">
            {/* Bell — 通知パネル */}
            <button
              onClick={() => { setShowNotifPanel(v => !v); setShowHelpModal(false); }}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500 relative"
              aria-label="通知を表示"
              aria-expanded={showNotifPanel}
            >
              <Bell className="w-4 h-4" />
              <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full border border-white" aria-hidden="true" />
            </button>

            {/* 通知パネル */}
            {showNotifPanel && (
              <>
                <div className="fixed inset-0 z-[45]" onClick={() => setShowNotifPanel(false)} />
                <div className="absolute top-full right-0 mt-2 w-72 bg-white border rounded-2xl shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b flex items-center justify-between">
                    <span className="text-xs font-black text-[#191714] uppercase tracking-widest">通知</span>
                    <button onClick={() => setShowNotifPanel(false)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors" aria-label="通知パネルを閉じる">
                      <X className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </div>
                  <div className="py-10 flex flex-col items-center gap-2 text-slate-500">
                    <Bell className="w-8 h-8 text-slate-200" />
                    <p className="text-xs font-bold">新着通知はありません</p>
                  </div>
                </div>
              </>
            )}

            {/* HelpCircle — ヘルプモーダルトリガー */}
            <button
              onClick={() => { setShowHelpModal(true); setShowNotifPanel(false); }}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
              aria-label="ヘルプを表示"
            >
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
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{getRoleLabel(user?.position)}</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 border overflow-hidden p-0.5 ring-2 ring-transparent hover:ring-slate-100 transition-all cursor-pointer">
              {user?.avatar ? (
                <Image src={user.avatar} width={32} height={32} alt={user.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                <div className="w-full h-full bg-slate-200 flex items-center justify-center rounded-full">
                  <User className="w-4 h-4 text-slate-500" />
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
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">アカウント</p>
              </div>
              <button
                onClick={() => { setIsMenuOpen(false); router.push('/organization'); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <User className="w-3.5 h-3.5 text-slate-500" />
                プロフィール設定
              </button>
              <button
                onClick={() => { setIsMenuOpen(false); router.push('/admin'); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" />
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

      {/* ヘルプモーダル */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowHelpModal(false)} aria-hidden="true" />
          <div
            ref={helpModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-modal-title"
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
          >
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h3 id="help-modal-title" className="text-lg font-bold text-[#191714]">ヘルプ・よくある質問</h3>
              </div>
              <button type="button" onClick={() => setShowHelpModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="閉じる">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { icon: BookOpen, title: '申請の始め方', desc: 'サイドバーの「新規申請・相談」からカテゴリーを選び、内容を入力して送信してください。' },
                { icon: MessageCircle, title: '承認状況の確認', desc: '「自分の依頼状況」ページで申請ごとの進捗・承認ステップが確認できます。' },
                { icon: Settings, title: '管理者設定', desc: '管理者権限をお持ちの方は「管理者設定」からメンバー・カテゴリーの管理が可能です。' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-3 p-3 bg-slate-50 rounded-2xl">
                  <div className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center text-slate-500 shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#191714]">{title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 font-medium">{desc}</div>
                  </div>
                </div>
              ))}
              <p className="text-center text-[10px] text-slate-500 font-medium pt-2">
                詳細なサポートはサイドバーの「サポート・ヘルプ」からご連絡ください。
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
