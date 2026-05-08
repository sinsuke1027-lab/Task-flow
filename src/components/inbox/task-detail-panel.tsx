'use client';

import Image from 'next/image';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  MessageSquare,
  History,
  ShieldCheck,
  ChevronRight,
  FileText,
  Archive,
  Copy,
  Printer,
  AlarmClock,
  ArrowUpRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Task, AuditLog, Delegation, User } from '@/lib/repository/types';
import { ClientOnlyDate } from '@/components/common/client-only-date';
import { cn } from '@/lib/utils';
import { isMyTurn } from '@/lib/workflow-utils';

interface TaskDetailPanelProps {
  selectedTask: Task | null;
  onClose: () => void;
  logs: AuditLog[];
  allUsers: User[];
  delegations: Delegation[];
  user: User | null;
  isProcessing: boolean;
  commentText: string;
  onCommentChange: (text: string) => void;
  now: Date;
  onApprove: () => void;
  onAcknowledge: () => void;
  onReject: () => void;
  onOpenChangeApprover: (idx: number) => void;
  onExportPdf: () => void;
  onAddComment: () => void;
}

export function TaskDetailPanel({
  selectedTask,
  onClose,
  logs,
  allUsers,
  delegations,
  user,
  isProcessing,
  commentText,
  onCommentChange,
  now,
  onApprove,
  onAcknowledge,
  onReject,
  onOpenChangeApprover,
  onExportPdf,
  onAddComment,
}: TaskDetailPanelProps) {
  const router = useRouter();

  return (
    <div className={cn(
      "overflow-y-auto bg-white p-4 md:p-6",
      "flex-1",
      selectedTask
        ? "block fixed inset-0 z-30 md:relative md:inset-auto md:z-auto animate-in slide-in-from-right-4 duration-300"
        : "hidden md:block",
    )}>
      {selectedTask ? (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* モバイル専用: 戻るボタン */}
          <button
            onClick={onClose}
            className="md:hidden flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors mb-2 -ml-1"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            一覧に戻る
          </button>
          {/* SLAエスカレーションバナー */}
          {selectedTask.status !== 'completed' && new Date(selectedTask.dueDate) < now && (() => {
            const overdueDays = Math.floor((now.getTime() - new Date(selectedTask.dueDate).getTime()) / 86400000);
            const urgency = overdueDays >= 5 ? 'critical' : overdueDays >= 2 ? 'high' : 'medium';
            return (
              <div className={cn(
                "flex items-start gap-3 px-4 py-3 rounded-2xl border animate-in fade-in duration-300",
                urgency === 'critical' ? "bg-rose-50 border-rose-200" :
                urgency === 'high'     ? "bg-orange-50 border-orange-200" :
                                        "bg-amber-50 border-amber-200"
              )}>
                <AlarmClock className={cn(
                  "w-4 h-4 mt-0.5 shrink-0",
                  urgency === 'critical' ? "text-rose-600" : urgency === 'high' ? "text-orange-600" : "text-amber-600"
                )} />
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-xs font-black",
                    urgency === 'critical' ? "text-rose-700" : urgency === 'high' ? "text-orange-700" : "text-amber-700"
                  )}>
                    SLA 超過 — {overdueDays}日経過
                    {urgency === 'critical' && '（緊急対応が必要です）'}
                  </p>
                  <p className={cn(
                    "text-[10px] font-medium mt-0.5",
                    urgency === 'critical' ? "text-rose-700" : urgency === 'high' ? "text-orange-700" : "text-amber-700"
                  )}>
                    期限: <ClientOnlyDate date={selectedTask.dueDate} /> ／ 現在の担当者が未処理のため遅延しています
                  </p>
                </div>
              </div>
            );
          })()}
          <header className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-slate-100 border text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {selectedTask.category}
                </span>
                {selectedTask.taskType === 'circulation' && (
                  <span className="px-2 py-1 rounded-full bg-teal-50 border border-teal-200 text-[10px] font-black text-teal-600 uppercase tracking-widest">
                    回覧
                  </span>
                )}
                <span className="text-[10px] font-bold text-slate-500">ID: {selectedTask.id}</span>
              </div>
              <button
                onClick={onExportPdf}
                title="稟議書をPDFで出力"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all uppercase tracking-widest"
                aria-label="稟議書PDF出力"
              >
                <Printer className="w-3.5 h-3.5" />
                稟議書
              </button>
            </div>
            <h1 className="text-xl font-black tracking-tight text-[#191714] leading-tight">
              {selectedTask.title}
            </h1>
            <div className="flex items-center gap-6 py-2 border-y border-slate-100">
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">申請者</div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold">U</div>
                  <span className="text-xs font-bold text-[#191714]">User {selectedTask.requesterId.split('_').pop()}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">期限 (SLA)</div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-[#191714]"><ClientOnlyDate date={selectedTask.dueDate} /></span>
                </div>
              </div>
            </div>
          </header>

          <section className="space-y-4">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <FileText className="w-4 h-4" />
              依頼内容の詳細
            </h3>
            <div className="text-sm font-medium text-slate-600 leading-relaxed bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
              {selectedTask.description || <span className="text-slate-500 italic">追加の説明はありません。</span>}
            </div>
            {selectedTask.customData && Object.keys(selectedTask.customData).length > 0 && (
              <div className="mt-6 space-y-4 bg-white p-6 rounded-2xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">追加フォーム入力内容</h4>
                <div className="grid grid-cols-2 gap-y-4">
                  {Object.entries(selectedTask.customData).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">{key}</div>
                      <div className="text-sm font-bold text-[#191714]">{value as string}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Approval Route Visual */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                現在の承認ステータス
              </h3>
              {selectedTask.approvalRoute && selectedTask.approvalRoute.length > 0 && (() => {
                const completed = selectedTask.approvalRoute.filter(s => s.status === 'approved').length;
                const total = selectedTask.approvalRoute.length;
                return (
                  <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-bold">
                    {completed} / {total} ステップ完了
                  </span>
                );
              })()}
            </div>
            {(() => {
              const activeStageSteps = selectedTask.approvalRoute.filter(
                s => s.status === 'pending' && s.parallelType === 'and'
              );
              if (activeStageSteps.length < 2) return null;
              const names = activeStageSteps.map(s => s.userName).join('・');
              return (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 border border-violet-100 rounded-2xl">
                  <span className="text-[10px] font-black text-violet-500 uppercase tracking-widest">AND 並列</span>
                  <span className="text-xs font-bold text-violet-700">{names} が同時に承認待ちです（全員の承認が必要）</span>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedTask.approvalRoute?.map((step, idx) => {
                const isDelegated = !!step.delegatedBy;
                const delegateUser = isDelegated ? allUsers.find(u => u.id === step.delegatedBy) : null;
                const isParallel = step.parallelType !== undefined;
                const stepLabel =
                  selectedTask.taskType === 'circulation'
                    ? step.status === 'approved' ? '確認済' : '未確認'
                    : step.status === 'approved' ? '承認済' : step.status === 'rejected' ? '差し戻し' : '待機中';
                return (
                  <div key={idx} className="relative p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-400 transition-all notion-shadow group">
                    {isParallel && (
                      <span className={cn(
                        "absolute top-2 left-3 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border",
                        step.parallelType === 'and' ? "bg-violet-50 text-violet-500 border-violet-100" : "bg-amber-50 text-amber-500 border-amber-100",
                      )}>
                        {step.parallelType === 'and' ? 'AND' : 'OR'}
                      </span>
                    )}
                    <div className="absolute top-3 right-3">
                      {step.status === 'approved' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : step.status === 'rejected' ? (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-200" />
                      )}
                    </div>
                    {step.avatar
                      ? <Image src={step.avatar} width={40} height={40} alt={step.userName} className="w-10 h-10 rounded-xl bg-slate-100 mb-3 mt-2" />
                      : <div className="w-10 h-10 rounded-xl bg-slate-100 mb-3 mt-2" />
                    }
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">{step.position}</div>
                    <div className="text-xs font-bold text-[#191714]">{step.userName}</div>
                    {isDelegated && delegateUser && (
                      <div className="text-[9px] font-bold text-violet-500 mt-0.5">代理: {delegateUser.name}</div>
                    )}
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                        step.status === 'approved' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                        step.status === 'rejected' ? "bg-rose-50 text-rose-500 border-rose-100" :
                        "bg-slate-50 text-slate-500 border-slate-100"
                      )}>
                        {stepLabel}
                      </span>
                      {step.status === 'pending' && (
                        <button
                          onClick={() => onOpenChangeApprover(idx)}
                          className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          aria-label={`${step.userName}の承認者を変更`}
                        >
                          変更
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedTask.ccRoute && selectedTask.ccRoute.length > 0 && (
              <div className="pt-2 animate-in fade-in duration-500">
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CC（共有先）</div>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedTask.ccRoute.map((cc, idx) => (
                    <div key={idx} className="flex items-center gap-2 pl-1 pr-3 py-1 bg-slate-50 border border-slate-100 rounded-full hover:bg-slate-100 transition-colors group cursor-default">
                      {cc.avatar
                        ? <Image src={cc.avatar} width={20} height={20} alt={cc.userName} className="w-5 h-5 rounded-full bg-slate-200" />
                        : <div className="w-5 h-5 rounded-full bg-slate-200" />
                      }
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[#191714] leading-tight">{cc.userName}</span>
                        <span className="text-[8px] font-medium text-slate-500 leading-tight uppercase tracking-tighter">{cc.position}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Audit Logs (Timeline) */}
          <section className="space-y-6">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <History className="w-4 h-4" />
              アクティビティ履歴
            </h3>
            <div className="space-y-8 border-l-2 border-slate-100 pl-6 ml-2 relative">
              {logs.length > 0 ? logs.map((log, idx) => {
                const getActionTheme = (action: string) => {
                  switch (action) {
                    case 'submit': return { label: '提出', color: 'bg-blue-600', icon: <ArrowUpRight className="w-3 h-3 text-white" /> };
                    case 'approve': return { label: '承認', color: 'bg-emerald-500', icon: <CheckCircle2 className="w-3 h-3 text-white" /> };
                    case 'reject': return { label: '却下', color: 'bg-rose-500', icon: <AlertCircle className="w-3 h-3 text-white" /> };
                    case 'reassign': return { label: '担当者変更', color: 'bg-amber-500', icon: <History className="w-3 h-3 text-white" /> };
                    case 'comment': return { label: 'コメント', color: 'bg-slate-400', icon: <MessageSquare className="w-3 h-3 text-white" /> };
                    default: return { label: action, color: 'bg-slate-900', icon: <FileText className="w-3 h-3 text-white" /> };
                  }
                };
                const theme = getActionTheme(log.action);
                return (
                  <div key={log.id} className="relative animate-in fade-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
                    <div className={cn(
                      "absolute -left-[35px] top-0 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white shadow-sm",
                      theme.color
                    )}>
                      {theme.icon}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-[#191714]">{log.userName}</span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tight text-white",
                            theme.color
                          )}>
                            {theme.label}
                          </span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-500">
                          <ClientOnlyDate date={log.timestamp} showTime />
                        </div>
                      </div>
                      <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl text-xs font-medium text-slate-600 leading-relaxed">
                        {log.comment || `${theme.label}されました。`}
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic py-4">履歴データはまだありません</div>
              )}
            </div>
          </section>

          {/* In-App Messaging (Comments) */}
          <section className="space-y-6 pt-4 border-t">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              連絡・コメントを追加
            </h3>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold shrink-0">
                {user?.avatar ? <Image src={user.avatar} width={40} height={40} className="w-full h-full rounded-full object-cover" alt="avatar" /> : 'U'}
              </div>
              <div className="flex-1 space-y-3">
                <textarea
                  rows={3}
                  aria-label="コメントを入力"
                  placeholder="申請内容に関する質問や連絡事項を入力してください..."
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all resize-none"
                  value={commentText}
                  onChange={(e) => onCommentChange(e.target.value)}
                />
                <div className="flex justify-end">
                  <button
                    onClick={onAddComment}
                    disabled={!commentText.trim()}
                    className="px-6 py-2.5 bg-[#191714] text-white rounded-xl text-xs font-bold hover:bg-black transition-all disabled:opacity-30 disabled:pointer-events-none"
                  >
                    コメントを送信する
                  </button>
                </div>
              </div>
            </div>
          </section>

          <footer className="pt-10 space-y-3">
            {user && (() => {
              const delegation = delegations.find(d =>
                d.delegateId === user.id && d.isActive &&
                selectedTask.approvalRoute.some(s => s.userId === d.delegatorId && s.status === 'pending')
              );
              if (!delegation) return null;
              const delegatorName = allUsers.find(u => u.id === delegation.delegatorId)?.name ?? delegation.delegatorId;
              return (
                <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-100 rounded-2xl">
                  <span className="text-[10px] font-black text-violet-500 uppercase tracking-widest shrink-0">代決</span>
                  <span className="text-xs font-bold text-violet-700"><span className="text-violet-900">{delegatorName}</span> の代理として承認します</span>
                </div>
              );
            })()}
            <div className="flex items-center gap-4">
              {selectedTask.status === 'completed' ? (
                <button
                  onClick={() => router.push(`/request?reuseTaskId=${selectedTask.id}`)}
                  className="flex-1 py-4 bg-slate-900 mx-auto text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all hover:shadow-xl hover:-translate-y-1"
                >
                  <Copy className="w-5 h-5" />
                  再利用して申請
                </button>
              ) : selectedTask.taskType === 'circulation' && user && selectedTask.approvalRoute.some(s => s.userId === user.id && s.status === 'pending') ? (
                <button
                  onClick={onAcknowledge}
                  disabled={isProcessing}
                  className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all hover:shadow-xl hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  確認済みにする
                </button>
              ) : user && isMyTurn(selectedTask, user.id, delegations) ? (
                <>
                  <button
                    onClick={onApprove}
                    disabled={isProcessing}
                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all hover:shadow-xl hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? '処理中...' : '承認・受理する'}
                  </button>
                  <button
                    onClick={onReject}
                    disabled={isProcessing}
                    className="px-8 py-4 bg-white border border-slate-200 text-rose-600 rounded-2xl font-bold hover:bg-rose-50 hover:border-rose-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    差し戻し
                  </button>
                </>
              ) : (
                <div className="flex-1 py-4 text-center text-sm font-bold text-slate-500 border border-dashed rounded-2xl">
                  現在あなたの対応番ではありません
                </div>
              )}
            </div>
          </footer>
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-slate-500">
          <Archive className="w-16 h-16 opacity-10 mb-4" />
          <p className="text-sm font-bold uppercase tracking-widest opacity-30">依頼を選択してください</p>
        </div>
      )}
    </div>
  );
}
