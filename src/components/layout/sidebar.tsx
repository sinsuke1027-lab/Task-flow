'use client';

import { useRef, useState } from 'react';
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
  LogOut,
  X,
  Mail,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useSidebar } from '@/context/sidebar-context';
import { useFocusTrap } from '@/hooks/useFocusTrap';

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
  const { isOpen, close } = useSidebar();
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const rulesModalRef = useRef<HTMLDivElement>(null);
  const helpModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(rulesModalRef, showRulesModal, () => setShowRulesModal(false));
  useFocusTrap(helpModalRef, showHelpModal, () => setShowHelpModal(false));

  const filteredNav = navigation.filter(item => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return item.roles.includes(user.position);
  });

  return (
    <>
      {/* モバイル: 画面外にスライドアウト。デスクトップ: 常時表示 */}
      <div
        className={cn(
          "flex flex-col h-full bg-[#FBFBFA] border-r w-64 select-none fixed left-0 top-0 z-50 transition-transform duration-300",
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
        role="navigation"
        aria-label="メインナビゲーション"
      >
        {/* Brand Logo */}
        <div className="p-6 pb-2 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group" onClick={close}>
            <div className="w-8 h-8 bg-[#191714] text-white rounded-lg flex items-center justify-center font-bold text-lg transition-transform group-hover:scale-110">
              TB
            </div>
            <span className="font-bold text-lg tracking-tight text-[#191714]">Task Bridge</span>
          </Link>
          {/* モバイルのみ表示: 閉じるボタン */}
          <button
            onClick={close}
            className="md:hidden p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            aria-label="メニューを閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 px-3 py-6 space-y-0.5">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">メニュー</div>
          {filteredNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold transition-all group",
                  isActive
                    ? "bg-white text-[#191714] notion-shadow border border-slate-200"
                    : "text-slate-500 hover:text-slate-600 hover:bg-slate-100/50"
                )}
              >
                <item.icon className={cn(
                  "w-4 h-4 transition-colors",
                  isActive ? "text-[#191714]" : "text-slate-500 group-hover:text-slate-500"
                )} />
                {item.name}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto text-slate-500" />}
              </Link>
            );
          })}

          <div className="pt-8 text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">ワークスペース</div>
          <Link
            href="/organization"
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold transition-all group",
              pathname === '/organization'
                ? "bg-white text-[#191714] notion-shadow border border-slate-200"
                : "text-slate-500 hover:text-slate-600 hover:bg-slate-100/50"
            )}
          >
            <Building2 className={cn(
              "w-4 h-4 transition-colors",
              pathname === '/organization' ? "text-[#191714]" : "text-slate-500 group-hover:text-slate-500"
            )} />
            組織図
          </Link>
          <button
            onClick={() => setShowRulesModal(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-600 hover:bg-slate-100/50 transition-all group"
          >
            <ShieldCheck className="w-4 h-4 text-slate-500 group-hover:text-slate-500" />
            社内規定・規約
          </button>
        </nav>

        {/* Footer Nav */}
        <div className="p-3 mt-auto space-y-0.5 border-t border-slate-100/10">
          <button
            onClick={() => setShowHelpModal(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-600 hover:bg-slate-100/50 transition-all group"
          >
            <HelpCircle className="w-4 h-4 text-slate-500 group-hover:text-slate-500" />
            サポート・ヘルプ
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all group"
          >
            <LogOut className="w-4 h-4 text-slate-500 group-hover:text-rose-500" />
            ログアウト
          </button>
        </div>
      </div>

      {/* 社内規定・規約モーダル */}
      {showRulesModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-8" role="dialog" aria-modal="true" aria-labelledby="rules-modal-title">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowRulesModal(false)} aria-hidden="true" />
          <div ref={rulesModalRef} className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 id="rules-modal-title" className="text-lg font-bold text-[#191714]">社内規定・規約</h3>
              </div>
              <button onClick={() => setShowRulesModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="モーダルを閉じる">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { label: '就業規則', desc: '2024年4月改定版' },
                { label: '情報セキュリティポリシー', desc: '全社適用' },
                { label: '申請・稟議規程', desc: '承認フロー・権限テーブル含む' },
                { label: '個人情報保護方針', desc: 'プライバシーポリシー' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-[#191714]">{item.label}</div>
                    <div className="text-[10px] text-slate-500 font-medium">{item.desc}</div>
                  </div>
                </div>
              ))}
              <p className="text-center text-[10px] text-slate-500 font-medium pt-2">
                詳細は人事部ポータルをご確認ください（準備中）
              </p>
            </div>
          </div>
        </div>
      )}

      {/* サポート・ヘルプモーダル */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-8" role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowHelpModal(false)} aria-hidden="true" />
          <div ref={helpModalRef} className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h3 id="help-modal-title" className="text-lg font-bold text-[#191714]">サポート・ヘルプ</h3>
              </div>
              <button onClick={() => setShowHelpModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="モーダルを閉じる">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 font-medium">
                ご不明な点は以下の窓口にお問い合わせください。
              </p>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[#191714]">
                  <Mail className="w-4 h-4 text-slate-500" />
                  システム管理部
                </div>
                <p className="text-xs text-slate-500 pl-6">helpdesk@digitalfoln.co.jp</p>
                <p className="text-xs text-slate-500 pl-6">受付時間: 平日 9:00 〜 18:00</p>
              </div>
              <p className="text-center text-[10px] text-slate-500 font-medium">
                緊急の場合は内線 #5000 へお電話ください
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
