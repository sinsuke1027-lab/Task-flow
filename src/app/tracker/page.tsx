'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Calendar,
  History,
  X,
  FileText,
  MessageSquare,
  XCircle,
  Zap,
  Search,
  RotateCcw,
  Download,
  Printer,
} from 'lucide-react';
import { getDataProvider } from '@/lib/repository/factory';
import { Task, AuditLog, User } from '@/lib/repository/types';
import { printApprovalPdf, downloadTasksCsv } from '@/lib/export/approval-pdf';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { ClientOnlyDate } from '@/components/common/client-only-date';

const PRIORITY_MAP = {
  high:   { label: '急ぎ',  className: 'bg-rose-50 text-rose-700 border-rose-100' },
  normal: { label: '通常',  className: 'bg-slate-50 text-slate-500 border-slate-100' },
  low:    { label: '低',    className: 'bg-sky-50 text-sky-400 border-sky-100' },
};

export default function ProgressTracker() {
  const { user } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'in_progress' | 'completed' | 'rejected'>('all');

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    const provider = getDataProvider();
    const [allTasks, allUsers] = await Promise.all([
      provider.getTasks(),
      provider.getUsers(),
    ]);
    const myRequests = allTasks.filter(t => t.requesterId === user.id);
    setTasks(myRequests);
    setUsers(allUsers);
    // 選択中タスクの内容を最新化
    setSelectedTask(prev => prev ? myRequests.find(t => t.id === prev.id) ?? null : null);
  }, [user]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const fetchLogs = async () => {
      if (selectedTask) {
        const provider = getDataProvider();
        const auditLogs = await provider.getAuditLogs(selectedTask.id);
        setLogs(auditLogs);
      }
    };
    fetchLogs();
  }, [selectedTask]);

  const getStatusLabel = (status: string) => {
    const mapping: Record<string, string> = {
      'todo': '未着手',
      'in_progress': '進行中',
      'completed': '完了',
    };
    return mapping[status] || status;
  };

  const handleAddComment = async () => {
    if (!selectedTask || !user || !commentText.trim()) return;
    const provider = getDataProvider();
    await provider.addComment(selectedTask.id, user.id, commentText);
    const newLogs = await provider.getAuditLogs(selectedTask.id);
    setLogs(newLogs);
    setCommentText('');
  };

  // B-2: 検索・フィルター
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchQuery = searchQuery === '' ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.category ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus =
        statusFilter === 'all' ? true :
        statusFilter === 'rejected' ? t.statusId === 'status_rejected' :
        t.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [tasks, searchQuery, statusFilter]);

  // A-2: 申請キャンセル
  const canCancel = (task: Task) =>
    task.requesterId === user?.id &&
    task.status !== 'completed' &&
    task.approvalRoute.every(s => s.status === 'pending');

  const handleCancel = async () => {
    if (!selectedTask || !user) return;
    setIsCancelling(true);
    try {
      const provider = getDataProvider();
      await provider.updateTask(selectedTask.id, {
        statusId: 'status_rejected',
        status: 'todo',
        currentApproverId: undefined,
        currentApproverName: undefined,
      });
      await provider.addComment(selectedTask.id, user.id, '申請者によってキャンセルされました。');
      await fetchTasks();
      setSelectedTask(null);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#191714]">自分の依頼状況</h1>
            <p className="text-slate-500 font-medium text-sm">これまでに提出した申請の進捗状況を確認できます。</p>
          </div>
          <button
            onClick={() => downloadTasksCsv(filteredTasks, users, 'my-tasks.csv')}
            disabled={filteredTasks.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            <Download className="w-3.5 h-3.5" />
            CSV 出力
          </button>
        </div>

        {/* B-2: 検索・フィルターバー */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="タイトル・カテゴリーで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-slate-900 transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-1">
            {([
              { value: 'all',        label: 'すべて' },
              { value: 'todo',       label: '未着手' },
              { value: 'in_progress',label: '進行中' },
              { value: 'completed',  label: '完了' },
              { value: 'rejected',   label: '却下' },
            ] as const).map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
                  statusFilter === f.value
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Task Table */}
      <div className="bg-white rounded-2xl border border-slate-200 notion-shadow overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm font-bold uppercase tracking-widest">
            該当する申請がありません
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b">
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">ステータス</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">タイトル / カテゴリー</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">承認進捗</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">期限</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.map((task) => {
                const approvedCount = task.approvalRoute.filter(s => s.status === 'approved').length;
                const totalSteps = task.approvalRoute.length;
                const priority = PRIORITY_MAP[task.priority] ?? PRIORITY_MAP.normal;
                const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'completed';

                return (
                  <tr
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="group hover:bg-slate-50/50 transition-all cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight border",
                          task.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          task.status === 'in_progress' ? "bg-blue-50 text-blue-600 border-blue-100" :
                          "bg-slate-50 text-slate-500 border-slate-100"
                        )}>
                          {getStatusLabel(task.status)}
                        </span>
                        {task.priority !== 'normal' && (
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase border flex items-center gap-0.5",
                            priority.className
                          )}>
                            {task.priority === 'high' && <Zap className="w-2 h-2" />}
                            {priority.label}
                          </span>
                        )}
                        {isOverdue && (
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="text-sm font-bold text-[#191714] group-hover:text-blue-600 transition-colors line-clamp-1">{task.title}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{task.category}</div>
                    </td>
                    <td className="px-4 py-3 w-40">
                      {totalSteps > 0 ? (
                        <div className="space-y-1">
                          <div className="flex gap-0.5">
                            {task.approvalRoute.map((step, idx) => (
                              <div
                                key={idx}
                                className={cn(
                                  "flex-1 h-1 rounded-full transition-all",
                                  step.status === 'approved' ? "bg-emerald-500" :
                                  step.status === 'rejected' ? "bg-rose-400" :
                                  task.currentApproverId === step.userId ? "bg-blue-400" :
                                  "bg-slate-100"
                                )}
                              />
                            ))}
                          </div>
                          <div className="text-[9px] font-black text-slate-500">{approvedCount}/{totalSteps} ステップ</div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        "text-[10px] font-bold",
                        isOverdue ? "text-rose-700" : "text-slate-500"
                      )}>
                        <ClientOnlyDate date={task.dueDate} />
                      </span>
                    </td>
                    <td className="pr-3">
                      <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-slate-900 transition-colors" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-end p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedTask(null)} />
          <div className="relative w-full max-w-2xl h-full bg-white rounded-3xl shadow-2xl overflow-y-auto animate-in slide-in-from-right-10 duration-500">
            <div className="sticky top-0 bg-white/80 backdrop-blur-md px-8 py-6 border-b flex items-center justify-between z-10 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">TB</div>
                <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Task Trace</div>
                  <div className="text-sm font-bold text-[#191714]">進捗トラッカー</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printApprovalPdf(selectedTask, users)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition-all"
                  title="稟議書を印刷・PDF保存"
                >
                  <Printer className="w-3.5 h-3.5" />
                  稟議書
                </button>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500 hover:text-slate-900"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <header className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-slate-100 border text-[10px] font-black text-slate-500 uppercase tracking-widest">{selectedTask.category}</span>
                  {/* A-1: 優先度バッジ（詳細） */}
                  {(() => {
                    const p = PRIORITY_MAP[selectedTask.priority] ?? PRIORITY_MAP.normal;
                    return (
                      <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black border flex items-center gap-1", p.className)}>
                        {selectedTask.priority === 'high' && <Zap className="w-3 h-3" />}
                        優先度: {p.label}
                      </span>
                    );
                  })()}
                  <span className="text-[10px] font-bold text-slate-500">ID: {selectedTask.id}</span>
                </div>
                <h1 className="text-xl font-black tracking-tight text-[#191714] leading-tight">
                  {selectedTask.title}
                </h1>

                {/* A-3: 承認進捗ステッパー（詳細） */}
                {selectedTask.approvalRoute.length > 0 && (
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">承認進捗</div>
                    <div className="flex items-center gap-0">
                      {selectedTask.approvalRoute.map((step, idx) => (
                        <div key={idx} className="flex items-center flex-1 min-w-0">
                          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0 transition-all",
                              step.status === 'approved' ? "bg-emerald-500 border-emerald-500" :
                              step.status === 'rejected' ? "bg-rose-400 border-rose-400" :
                              selectedTask.currentApproverId === step.userId ? "bg-blue-500 border-blue-500 ring-2 ring-blue-200" :
                              "bg-white border-slate-200"
                            )}>
                              {step.status === 'approved'
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                : step.status === 'rejected'
                                ? <XCircle className="w-3.5 h-3.5 text-white" />
                                : selectedTask.currentApproverId === step.userId
                                ? <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                : <div className="w-2 h-2 bg-slate-200 rounded-full" />
                              }
                            </div>
                            <span className="text-[8px] font-bold text-slate-500 truncate w-full text-center px-1">{step.userName.split(' ')[0]}</span>
                          </div>
                          {idx < selectedTask.approvalRoute.length - 1 && (
                            <div className={cn(
                              "h-0.5 flex-1 mx-1 mb-4",
                              step.status === 'approved' ? "bg-emerald-300" : "bg-slate-100"
                            )} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-6 py-3 border-y border-slate-100">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">現在のステータス</div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-sm font-black text-blue-600 uppercase tracking-widest">{getStatusLabel(selectedTask.status)}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">目標完了日 (SLA)</div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-bold text-[#191714]"><ClientOnlyDate date={selectedTask.dueDate} /></span>
                    </div>
                  </div>
                </div>
              </header>

              <section className="space-y-4">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  申請内容の要約
                </h3>
                <div className="text-sm font-medium text-slate-600 leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  {selectedTask.description || <span className="text-slate-500 italic">追加の説明はありません。</span>}
                </div>

                {selectedTask.customData && Object.keys(selectedTask.customData).length > 0 && (
                  <div className="mt-6 space-y-4 bg-white p-6 rounded-2xl border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">申請時の入力データ</h4>
                    <div className="grid grid-cols-2 gap-y-4">
                      {Object.entries(selectedTask.customData).map(([key, value]) => (
                        <div key={key} className="space-y-1">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{key}</div>
                          <div className="text-sm font-bold text-[#191714]">{value as string}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Approval Route Visual */}
              <section className="space-y-3">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  承認の軌跡
                </h3>
                <div className="space-y-4 relative pl-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {selectedTask.approvalRoute?.map((step, idx) => (
                    <div key={idx} className="relative flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-400 transition-all notion-shadow-sm group">
                      <div className={cn(
                        "absolute -left-[30px] w-5 h-5 rounded-full border-4 border-white flex items-center justify-center transition-all",
                        step.status === 'approved' ? "bg-emerald-500 scale-110" :
                        step.status === 'rejected' ? "bg-rose-400 scale-110" :
                        selectedTask.currentApproverId === step.userId ? "bg-blue-500 ring-2 ring-blue-200" :
                        "bg-slate-200"
                      )}>
                        {step.status === 'approved' && <CheckCircle2 className="w-3 h-3 text-white" />}
                        {step.status === 'rejected' && <XCircle className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex items-center gap-4">
                        {step.avatar
                          ? <Image src={step.avatar} width={40} height={40} className="w-10 h-10 rounded-xl bg-slate-100" alt="" />
                          : <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">U</div>
                        }
                        <div>
                          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">{step.position || '役職なし'}</div>
                          <div className="text-sm font-bold text-[#191714]">{step.userName}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                          step.status === 'approved' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          step.status === 'rejected' ? "bg-rose-50 text-rose-600 border-rose-100" :
                          selectedTask.currentApproverId === step.userId ? "bg-blue-50 text-blue-600 border-blue-100" :
                          "bg-slate-50 text-slate-500 border-slate-100"
                        )}>
                          {step.status === 'approved' ? '承認済' :
                           step.status === 'rejected' ? '差し戻し' :
                           selectedTask.currentApproverId === step.userId ? '対応中' : '審査待ち'}
                        </span>
                        {step.processedAt && (
                          <div className="text-[8px] font-bold text-slate-500">
                            <ClientOnlyDate date={step.processedAt} showTime />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Log History */}
              <section className="space-y-6">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <History className="w-4 h-4" />
                  アクション履歴
                </h3>
                <div className="space-y-4 border-l-2 border-slate-100 pl-6 ml-2">
                  {logs.map((log) => (
                    <div key={log.id} className="relative">
                      <div className="absolute -left-[31px] top-1 w-2 h-2 rounded-full bg-slate-200 ring-4 ring-white" />
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-500"><ClientOnlyDate date={log.timestamp} showTime /></div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#191714]">{log.userName}</span>
                          <span className="text-xs font-medium text-slate-500">が</span>
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[9px] font-bold uppercase tracking-widest">
                            {log.action === 'approve' ? '承認' :
                             log.action === 'reject' ? '差し戻し' :
                             log.action === 'submit' ? '申請' :
                             log.action === 'comment' ? 'コメント' : log.action}
                          </span>
                          <span className="text-xs font-medium text-slate-500">しました。</span>
                        </div>
                        {log.comment && (
                          <div className="mt-2 p-3 bg-slate-50 border rounded-xl text-xs font-medium text-slate-600 italic">
                            &quot;{log.comment}&quot;
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
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
                      placeholder="この依頼に関する質問や状況確認などのメッセージを入力..."
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all resize-none"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleAddComment}
                        disabled={!commentText.trim()}
                        className="px-6 py-2.5 bg-[#191714] text-white rounded-xl text-xs font-bold hover:bg-black transition-all disabled:opacity-30 disabled:pointer-events-none"
                      >
                        メッセージを送信
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* A-2: キャンセルボタン */}
              {canCancel(selectedTask) && (
                <section className="pt-4 border-t border-dashed border-rose-100">
                  <button
                    onClick={handleCancel}
                    disabled={isCancelling}
                    className="w-full py-3 rounded-2xl border border-rose-200 text-rose-500 text-sm font-bold hover:bg-rose-50 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    {isCancelling ? 'キャンセル中...' : 'この申請をキャンセルする'}
                  </button>
                  <p className="text-center text-[10px] text-slate-500 mt-2 font-medium">承認者がまだ処理していない場合のみキャンセルできます</p>
                </section>
              )}

              {/* B-1: 差し戻し後の再申請ボタン */}
              {selectedTask.statusId === 'status_rejected' && selectedTask.requesterId === user?.id && (
                <section className="pt-4 border-t border-dashed border-amber-100">
                  <button
                    onClick={() => {
                      setSelectedTask(null);
                      router.push(`/request?reuseTaskId=${selectedTask.id}&resubmit=true`);
                    }}
                    className="w-full py-3 rounded-2xl border border-amber-200 text-amber-600 text-sm font-bold hover:bg-amber-50 transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    修正して再申請する
                  </button>
                  <p className="text-center text-[10px] text-slate-500 mt-2 font-medium">内容を修正し、同じ申請として再送信できます</p>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
