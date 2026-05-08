'use client';

import { useState, useMemo } from 'react';
import { Search, CalendarDays, FileText } from 'lucide-react';
import { AuditLog } from '@/lib/repository/types';
import { ClientOnlyDate } from '@/components/common/client-only-date';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface AdminAuditLogsSectionProps {
  logs: AuditLog[];
  onNavigateToTask: (taskId: string) => void;
}

export function AdminAuditLogsSection({ logs, onNavigateToTask }: AdminAuditLogsSectionProps) {
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      result = result.filter(l =>
        l.userName?.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.comment?.toLowerCase().includes(q)
      );
    }
    if (logStartDate) result = result.filter(l => new Date(l.timestamp) >= new Date(logStartDate));
    if (logEndDate) result = result.filter(l => new Date(l.timestamp) <= new Date(logEndDate + 'T23:59:59'));
    return result;
  }, [logs, logSearchQuery, logStartDate, logEndDate]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <section className="bg-white rounded-3xl border border-slate-200 notion-shadow overflow-hidden">
        <div className="p-6 border-b flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#191714]">全社監査ログ</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">System-wide Activity History</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="監査ログを検索"
                placeholder="ユーザー名、アクション種別で検索..."
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-slate-400 transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-slate-500" />
              <input
                type="date"
                aria-label="開始日"
                value={logStartDate}
                onChange={(e) => setLogStartDate(e.target.value)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-slate-400 transition-all"
              />
              <span className="text-slate-300 font-bold text-xs">~</span>
              <input
                type="date"
                aria-label="終了日"
                value={logEndDate}
                onChange={(e) => setLogEndDate(e.target.value)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-slate-400 transition-all"
              />
              {(logStartDate || logEndDate) && (
                <button
                  onClick={() => { setLogStartDate(''); setLogEndDate(''); }}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-widest"
                >
                  クリア
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">日時</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">実行者</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">アクション</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">詳細</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-500">
                      <ClientOnlyDate date={log.timestamp} showTime={true} />
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-[#191714]">{log.userName}</span>
                    {log.comment && <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{log.comment}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-tight px-2 py-0.5 rounded-full inline-flex items-center gap-1",
                      log.action === 'approve' ? "bg-emerald-100 text-emerald-700" :
                      log.action === 'reject' ? "bg-rose-100 text-rose-700" :
                      log.action === 'reassign' ? "bg-amber-100 text-amber-700" :
                      log.action === 'submit' ? "bg-blue-100 text-blue-700" :
                      "bg-slate-100 text-slate-600"
                    )}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href="/inbox"
                      onClick={() => onNavigateToTask(log.taskId)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      該当タスクへ
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-sm font-medium">
                    該当するログデータがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
