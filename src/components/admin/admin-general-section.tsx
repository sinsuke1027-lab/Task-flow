'use client';

import { useState } from 'react';
import { Save, RefreshCw, Download, CheckCircle2, Globe, Shield, Clock } from 'lucide-react';
import { Task, User } from '@/lib/repository/types';
import { downloadTasksCsv } from '@/lib/export/approval-pdf';
import { mockProvider } from '@/lib/repository/mock-provider';


interface AdminStats {
  total: number;
  completed: number;
  overdue: number;
  inProgress: number;
  approvalRate: number;
  avgDays: number;
}

interface AdminGeneralSectionProps {
  adminStats: AdminStats;
  tasks: Task[];
  users: User[];
  now: number;
}

export function AdminGeneralSection({ adminStats, tasks, users, now }: AdminGeneralSectionProps) {
  const [tenantName, setTenantName] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('tb_tenant_name') || '株式会社デジタルフォルン (Task Flow)';
    return '株式会社デジタルフォルン (Task Flow)';
  });
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const handleSaveSettings = () => {
    localStorage.setItem('tb_tenant_name', tenantName);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: '全申請数', value: adminStats.total, sub: 'Total Tasks', color: 'text-slate-900' },
          { label: '完了済み', value: adminStats.completed, sub: 'Completed', color: 'text-emerald-600' },
          { label: '処理中', value: adminStats.inProgress, sub: 'In Progress', color: 'text-blue-600' },
          { label: '期限超過', value: adminStats.overdue, sub: 'Overdue', color: 'text-rose-600' },
          { label: '承認率', value: `${adminStats.approvalRate}%`, sub: 'Approval Rate', color: 'text-violet-600' },
          { label: '平均処理日数', value: `${adminStats.avgDays}日`, sub: 'Avg. Lead Time', color: 'text-amber-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-2xl notion-shadow p-3 space-y-1">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</div>
            <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{stat.sub}</div>
          </div>
        ))}
      </div>

      <section className="bg-white rounded-3xl border border-slate-200 notion-shadow p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#191714]">システム基本情報</h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">General System Settings</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadTasksCsv(tasks, users, 'all-tasks.csv')}
              disabled={tasks.length === 0}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <Download className="w-4 h-4" />
              全タスク CSV
            </button>
            <button
              onClick={() => {
                if (!confirm('モックデータをJSON初期値にリセットします。現在の変更はすべて失われます。よろしいですか？')) return;
                mockProvider.clearStorage();
                window.location.reload();
              }}
              className="flex items-center gap-2 px-4 py-2 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-50 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              データをリセット
            </button>
            <button
              onClick={handleSaveSettings}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
            >
              <Save className="w-4 h-4" />
              設定を保存
            </button>
          </div>
        </div>
        {showSaveSuccess && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 animate-in slide-in-from-top-2 duration-300">
            <CheckCircle2 className="w-4 h-4" /> 設定を保存しました
          </div>
        )}
        <div className="grid grid-cols-2 gap-8 pt-4">
          <div className="space-y-2">
            <label htmlFor="admin-tenant-name" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">テナント名</label>
            <input
              id="admin-tenant-name"
              type="text"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              className="w-full h-10 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">データソース</label>
            <div className="w-full h-10 px-4 bg-slate-100 border rounded-xl flex items-center justify-between">
              <span className="text-sm font-bold text-slate-500">SharePoint Lists (Mocked)</span>
              <Shield className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
        </div>
      </section>

      {tasks.filter(t => t.status !== 'completed' && new Date(t.dueDate) < new Date()).length > 0 && (
        <section className="bg-white rounded-3xl border border-rose-200 notion-shadow overflow-hidden">
          <div className="p-5 border-b border-rose-100 flex items-center justify-between bg-rose-50/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-800">SLA 超過アラート</h3>
                <p className="text-[10px] font-bold text-rose-700 uppercase tracking-widest">
                  {tasks.filter(t => t.status !== 'completed' && new Date(t.dueDate) < new Date()).length}件のタスクが期限を超過しています
                </p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-rose-50">
            {tasks
              .filter(t => t.status !== 'completed' && new Date(t.dueDate) < new Date())
              .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
              .slice(0, 5)
              .map(t => {
                const overdueDays = Math.floor((now - new Date(t.dueDate).getTime()) / 86400000);
                return (
                  <div key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-rose-50/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-[#191714] truncate">{t.title}</div>
                      <div className="text-[10px] font-bold text-slate-500 mt-0.5">{t.category} ／ 担当: {t.currentApproverName ?? '未設定'}</div>
                    </div>
                    <span className="shrink-0 text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                      +{overdueDays}日超過
                    </span>
                  </div>
                );
              })
            }
          </div>
        </section>
      )}

      <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
          <Globe className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-amber-900">M365 Bridge 接続準備完了</h4>
          <p className="text-xs font-medium text-amber-700 mt-0.5">現在、モックプロバイダーを使用して動作しています。Azure ADへの切り替えは「環境設定」から可能です。</p>
        </div>
      </div>
    </div>
  );
}
