'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
  Search,
  Filter,
  MoreHorizontal,
  ArrowUpRight,
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
  X,
  Download,
  Printer,
  AlarmClock,
} from 'lucide-react';
import { downloadTasksCsv, printApprovalPdf } from '@/lib/export/approval-pdf';
import { isMyTurn } from '@/lib/workflow-utils';
import { useRouter } from 'next/navigation';
import { getDataProvider } from '@/lib/repository/factory';
import { Task, AuditLog, Category, Delegation } from '@/lib/repository/types';
import { useAuth } from '@/context/auth-context';
import { ClientOnlyDate } from '@/components/common/client-only-date';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export default function RequestInbox() {
  const { user } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'overdue' | 'completed'>('all');
  const [commentText, setCommentText] = useState('');
  const [inboxSearchQuery, setInboxSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'normal' | 'high'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [showChangeApproverModal, setShowChangeApproverModal] = useState(false);
  const [changingStepIndex, setChangingStepIndex] = useState<number | null>(null);
  const [allUsers, setAllUsers] = useState<import('@/lib/repository/types').User[]>([]);
  const [approverSearchQuery, setApproverSearchQuery] = useState('');
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const rejectModalRef = useRef<HTMLDivElement>(null);
  const changeApproverModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(rejectModalRef, showRejectModal, () => setShowRejectModal(false));
  useFocusTrap(changeApproverModalRef, showChangeApproverModal, () => setShowChangeApproverModal(false));

  const now = new Date('2026-04-02T09:05:57Z'); // For consistent testing matching current metadata

  const fetchTasks = useCallback(async (selectFirst = false) => {
    const provider = getDataProvider();
    const allTasks = await provider.getTasks();
    setTasks(allTasks);
    if (selectFirst && allTasks.length > 0) setSelectedTask(allTasks[0]);
  }, []);

  useEffect(() => {
    fetchTasks(true);
    const provider = getDataProvider();
    provider.getCategories().then(setCategories);
    provider.getUsers().then(setAllUsers);
    provider.getDelegations().then(setDelegations);
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

  const getFilteredTasks = () => {
    if (!user) return [];

    let baseTasks = tasks;
    const isAdmin = user.role === 'admin' || user.departmentId === 'dept_admin';

    // Role-based visibility
    if (!isAdmin) {
      baseTasks = tasks.filter(t =>
        t.approvalRoute.some(step => step.userId === user.id)
      );
    }

    let result = baseTasks.filter(t => {
      const isOverdue = new Date(t.dueDate) < now && t.status !== 'completed';

      if (filter === 'all') return true;
      if (filter === 'overdue') return isOverdue;
      if (filter === 'completed') return t.status === 'completed';

      if (!isAdmin) {
        if (filter === 'todo') return t.currentApproverId === user.id && !isOverdue;
        if (filter === 'in_progress') {
          const myStepIndex = t.approvalRoute.findIndex(s => s.userId === user.id);
          const myStep = t.approvalRoute[myStepIndex];
          const isAfterMe = t.approvalRoute.slice(myStepIndex + 1).some(s => s.status === 'pending');
          return myStep?.status === 'approved' && isAfterMe;
        }
      } else {
        return t.status === filter && !isOverdue;
      }
      return false;
    });

    // キーワード検索
    if (inboxSearchQuery.trim()) {
      const q = inboxSearchQuery.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q)
      );
    }

    // 期間フィルター
    if (periodFilter !== 'all') {
      const cutoff = new Date(now);
      if (periodFilter === 'today') cutoff.setHours(0, 0, 0, 0);
      else if (periodFilter === 'week') cutoff.setDate(cutoff.getDate() - 7);
      else if (periodFilter === 'month') cutoff.setMonth(cutoff.getMonth() - 1);
      result = result.filter(t => new Date(t.createdAt) >= cutoff);
    }

    // 優先度フィルター
    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter);
    }

    // カテゴリーフィルター
    if (categoryFilter !== 'all') {
      result = result.filter(t => t.categoryId === categoryFilter);
    }

    // ソート
    result = [...result].sort((a, b) => {
      if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortOrder === 'title') return a.title.localeCompare(b.title, 'ja');
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // newest
    });

    return result;
  };

  const filteredTasks = getFilteredTasks();

  const getStatusLabel = (status: string) => {
    const mapping: Record<string, string> = {
      'todo': '未着手',
      'in_progress': '対応中',
      'completed': '完了済み',
      'overdue': '期限超過',
    };
    return mapping[status] || status;
  };

  const handleApprove = async () => {
    if (!selectedTask || !user || isProcessing) return;
    setIsProcessing(true);
    const provider = getDataProvider();
    try {
      const updated = await provider.processApproval(selectedTask.id, user.id, 'approve');
      setSelectedTask(updated);
      await fetchTasks();
      const newLogs = await provider.getAuditLogs(selectedTask.id);
      setLogs(newLogs);
      toast.success('承認しました');
    } catch (error) {
      toast.error('承認処理に失敗しました');
      console.error('Approval failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!selectedTask || !user || isProcessing) return;
    setIsProcessing(true);
    const provider = getDataProvider();
    try {
      const updated = await provider.processApproval(selectedTask.id, user.id, 'acknowledge');
      setSelectedTask(updated);
      await fetchTasks();
      const newLogs = await provider.getAuditLogs(selectedTask.id);
      setLogs(newLogs);
      toast.success('確認しました');
    } catch (error) {
      toast.error('確認処理に失敗しました');
      console.error('Acknowledge failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = () => {
    setRejectComment('');
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedTask || !user || !rejectComment.trim() || isProcessing) return;
    setIsProcessing(true);
    const provider = getDataProvider();
    try {
      const updated = await provider.processApproval(selectedTask.id, user.id, 'reject', rejectComment.trim());
      setSelectedTask(updated);
      await fetchTasks();
      const newLogs = await provider.getAuditLogs(selectedTask.id);
      setLogs(newLogs);
      setShowRejectModal(false);
      setRejectComment('');
      toast.success('差し戻しました');
    } catch (error) {
      toast.error('差し戻し処理に失敗しました');
      console.error('Rejection failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenChangeApprover = (stepIndex: number) => {
    setChangingStepIndex(stepIndex);
    setApproverSearchQuery('');
    setShowChangeApproverModal(true);
  };

  const handleConfirmChangeApprover = async (newApproverId: string) => {
    if (!selectedTask || changingStepIndex === null) return;
    const provider = getDataProvider();
    try {
      const updated = await provider.updateApprovalRoute(selectedTask.id, changingStepIndex, newApproverId);
      setSelectedTask(updated);
      await fetchTasks();
      const newLogs = await provider.getAuditLogs(selectedTask.id);
      setLogs(newLogs);
      setShowChangeApproverModal(false);
      setChangingStepIndex(null);
      toast.success('承認者を変更しました');
    } catch (error) {
      toast.error('承認者の変更に失敗しました');
      console.error('Change approver failed:', error);
    }
  };

  const handleExportCsv = () => {
    const date = new Date().toISOString().split('T')[0];
    downloadTasksCsv(filteredTasks, allUsers, `inbox_${date}.csv`);
  };

  const handleExportPdf = () => {
    if (!selectedTask) return;
    printApprovalPdf(selectedTask, allUsers);
  };

  const handleAddComment = async () => {
    if (!selectedTask || !user || !commentText.trim()) return;
    const provider = getDataProvider();
    await provider.addComment(selectedTask.id, user.id, commentText);
    const newLogs = await provider.getAuditLogs(selectedTask.id);
    setLogs(newLogs);
    setCommentText('');
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-0 border rounded-3xl bg-white notion-shadow overflow-hidden group">
      {/* List Panel — デスクトップ: 常時表示。モバイル: 詳細表示中は非表示 */}
      <div className={cn(
        "flex-col border-r bg-[#FBFBFA]/50",
        "w-full md:w-96",
        selectedTask ? "hidden md:flex" : "flex",
      )}>
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[#191714] uppercase tracking-widest">依頼一覧</h2>
            <div className="flex items-center gap-1 relative">
              <button
                onClick={handleExportCsv}
                title="一覧をCSVでダウンロード"
                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                aria-label="CSVエクスポート"
              >
                <Download className="w-4 h-4 text-slate-500" />
              </button>
              {/* Filter ドロップダウン（期間フィルター） */}
              <div className="relative">
                <button
                  onClick={() => { setShowFilterDropdown(v => !v); setShowSortDropdown(false); }}
                  className={cn("p-1.5 hover:bg-slate-200 rounded-lg transition-colors", (periodFilter !== 'all' || priorityFilter !== 'all' || categoryFilter !== 'all') && "bg-blue-50 text-blue-600")}
                >
                  <Filter className="w-4 h-4 text-slate-500" />
                </button>
                {showFilterDropdown && (
                  <>
                    <div className="fixed inset-0 z-[45]" onClick={() => setShowFilterDropdown(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded-xl shadow-xl z-50 overflow-hidden animate-in zoom-in-95 duration-150">
                      <div className="px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b">期間</div>
                      {([
                        { value: 'all', label: '全期間' },
                        { value: 'today', label: '今日' },
                        { value: 'week', label: '今週' },
                        { value: 'month', label: '今月' },
                      ] as const).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => { setPeriodFilter(opt.value); }}
                          className={cn("w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-slate-50", periodFilter === opt.value ? "text-blue-600 bg-blue-50" : "text-slate-600")}
                        >
                          {opt.label}
                        </button>
                      ))}
                      <div className="px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-y mt-1">優先度</div>
                      {([
                        { value: 'all', label: 'すべて' },
                        { value: 'high', label: '急ぎ' },
                        { value: 'normal', label: '通常' },
                        { value: 'low', label: '低' },
                      ] as const).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => { setPriorityFilter(opt.value); }}
                          className={cn("w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-slate-50", priorityFilter === opt.value ? "text-blue-600 bg-blue-50" : "text-slate-600")}
                        >
                          {opt.label}
                        </button>
                      ))}
                      {categories.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-y mt-1">カテゴリー</div>
                          <button
                            onClick={() => { setCategoryFilter('all'); }}
                            className={cn("w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-slate-50", categoryFilter === 'all' ? "text-blue-600 bg-blue-50" : "text-slate-600")}
                          >
                            すべて
                          </button>
                          {categories.map(cat => (
                            <button
                              key={cat.id}
                              onClick={() => { setCategoryFilter(cat.id); }}
                              className={cn("w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-slate-50 truncate", categoryFilter === cat.id ? "text-blue-600 bg-blue-50" : "text-slate-600")}
                            >
                              {cat.name}
                            </button>
                          ))}
                        </>
                      )}
                      <div className="px-3 py-2 border-t">
                        <button
                          onClick={() => { setPeriodFilter('all'); setPriorityFilter('all'); setCategoryFilter('all'); setShowFilterDropdown(false); }}
                          className="w-full text-center text-[10px] font-black text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-widest"
                        >
                          リセット
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              {/* Sort ドロップダウン */}
              <div className="relative">
                <button
                  onClick={() => { setShowSortDropdown(v => !v); setShowFilterDropdown(false); }}
                  className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4 text-slate-500" />
                </button>
                {showSortDropdown && (
                  <>
                    <div className="fixed inset-0 z-[45]" onClick={() => setShowSortDropdown(false)} />
                    <div className="absolute right-0 top-full mt-1 w-36 bg-white border rounded-xl shadow-xl z-50 overflow-hidden animate-in zoom-in-95 duration-150">
                      <div className="px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b">ソート順</div>
                      {([
                        { value: 'newest', label: '新しい順' },
                        { value: 'oldest', label: '古い順' },
                        { value: 'title', label: '件名順' },
                      ] as const).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => { setSortOrder(opt.value); setShowSortDropdown(false); }}
                          className={cn("w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-slate-50", sortOrder === opt.value ? "text-slate-900 bg-slate-50" : "text-slate-600")}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              aria-label="依頼を検索"
              placeholder="依頼を検索..."
              value={inboxSearchQuery}
              onChange={(e) => setInboxSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-slate-900 transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
            {['すべて', '未着手', '対応中', '期限超過', '完了済み'].map((label, idx) => {
              const statusMap = ['all', 'todo', 'in_progress', 'overdue', 'completed'] as const;
              const currentStatus = statusMap[idx];
              const isActive = filter === currentStatus;
              return (
                <button 
                  key={label}
                  onClick={() => setFilter(currentStatus)}
                  className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
                    isActive ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100/50">
          {filteredTasks.map((task) => {
            const isOverdue = new Date(task.dueDate) < now && task.status !== 'completed';
            return (
              <button
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={cn(
                  "w-full text-left p-4 hover:bg-white transition-all group/item border-l-2",
                  selectedTask?.id === task.id ? "bg-white border-slate-900 shadow-sm z-10" : "border-transparent",
                  isOverdue ? "bg-rose-50/10" : ""
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">{task.category}</span>
                    {task.taskType === 'circulation' && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[8px] font-black bg-teal-50 text-teal-700 border border-teal-100">回覧</span>
                    )}
                  </div>
                  <span className={cn(
                    "shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight",
                    isOverdue ? "bg-rose-100 text-rose-700" :
                    task.status === 'completed' ? "bg-emerald-50 text-emerald-600" :
                    task.status === 'in_progress' ? "bg-blue-50 text-blue-600" :
                    "bg-slate-100 text-slate-500"
                  )}>
                    {isOverdue ? '期限超過' : getStatusLabel(task.status)}
                  </span>
                </div>
                <div className="text-sm font-bold text-[#191714] mb-1 group-hover/item:text-blue-600 transition-colors leading-snug">{task.title}</div>
                
                {/* Current Holder Display */}
                <div className="flex items-center gap-1.5 mt-2 mb-2">
                  <span className="text-[9px] font-bold text-slate-500">現在：</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-bold",
                    task.currentApproverId === user?.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                  )}>
                    {task.currentApproverName || (task.status === 'completed' ? '完了' : '部署対応中')}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold">U</div>
                    <span className="text-[10px] font-bold text-slate-500">{task.requesterId.split('_').pop()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    {isOverdue && (() => {
                      const days = Math.floor((now.getTime() - new Date(task.dueDate).getTime()) / 86400000);
                      return (
                        <span className="text-[8px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full border border-rose-200">
                          +{days}日超過
                        </span>
                      );
                    })()}
                    <div className={cn(
                      "text-[10px] font-bold",
                      isOverdue ? "text-rose-700" : "text-slate-500"
                    )}>
                      <ClientOnlyDate date={task.dueDate} />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 差し戻しモーダル */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowRejectModal(false)} aria-hidden="true" />
          <div
            ref={rejectModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-modal-title"
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
          >
            <div className="p-6 border-b flex items-center justify-between">
              <h3 id="reject-modal-title" className="text-lg font-bold text-[#191714]">差し戻し理由を入力</h3>
              <button type="button" onClick={() => setShowRejectModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="閉じる">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-sm text-slate-500 font-medium">申請者に差し戻す理由を入力してください。コメントは必須です。</p>
              {/* 定型テンプレート */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">定型テンプレート</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    '内容を修正して再申請してください',
                    '添付書類が不足しています',
                    '上長の承認を先に取得してください',
                    '予算超過のため再検討が必要です',
                  ].map(tmpl => (
                    <button
                      key={tmpl}
                      onClick={() => setRejectComment(tmpl)}
                      className="px-3 py-1.5 text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 hover:border-slate-400 transition-all text-slate-600"
                    >
                      {tmpl}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={4}
                aria-label="差し戻し理由"
                placeholder="差し戻し理由を入力してください（必須）..."
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all resize-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={!rejectComment.trim() || isProcessing}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-bold text-sm hover:bg-rose-700 transition-all disabled:opacity-30 disabled:pointer-events-none"
                >
                  {isProcessing ? '処理中...' : '差し戻しを確定'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 承認者変更モーダル */}
      {showChangeApproverModal && changingStepIndex !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowChangeApproverModal(false)} aria-hidden="true" />
          <div
            ref={changeApproverModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-approver-modal-title"
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
          >
            <div className="p-6 border-b flex items-center justify-between">
              <h3 id="change-approver-modal-title" className="text-lg font-bold text-[#191714]">承認者を変更</h3>
              <button type="button" onClick={() => setShowChangeApproverModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="閉じる">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 font-medium">
                ステップ {changingStepIndex + 1} の承認者を変更します。現在: <span className="font-bold text-slate-800">{selectedTask?.approvalRoute[changingStepIndex]?.userName}</span>
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  aria-label="承認者を検索"
                  placeholder="氏名で検索..."
                  value={approverSearchQuery}
                  onChange={(e) => setApproverSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-slate-900 transition-all"
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {allUsers
                  .filter(u => u.status === 'active' && (
                    !approverSearchQuery.trim() ||
                    u.name.toLowerCase().includes(approverSearchQuery.toLowerCase())
                  ))
                  .map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleConfirmChangeApprover(u.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all text-left group"
                    >
                      {u.avatar
                        ? <Image src={u.avatar} width={32} height={32} alt={u.name} className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-100 group-hover:border-slate-300" />
                        : <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{u.name[0]}</div>
                      }
                      <div>
                        <div className="text-sm font-bold text-slate-800">{u.name}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{u.position}</div>
                      </div>
                    </button>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Panel — デスクトップ: flex-1。モバイル: 詳細選択時のみ full-screen */}
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
              onClick={() => setSelectedTask(null)}
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
                  onClick={handleExportPdf}
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
              
              {/* Dynamic Form Custom Data Rendering */}
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
              {/* AND 並列ステージのヒント */}
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
                      {/* 並列バッジ */}
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
                            onClick={() => handleOpenChangeApprover(idx)}
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

              {/* CC Users Compact Display */}
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
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={handleAddComment}
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
              {/* 代決コンテキストバナー */}
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
                    onClick={handleAcknowledge}
                    disabled={isProcessing}
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all hover:shadow-xl hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    確認済みにする
                  </button>
                ) : user && isMyTurn(selectedTask, user.id, delegations) ? (
                  <>
                    <button
                      onClick={handleApprove}
                      disabled={isProcessing}
                      className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all hover:shadow-xl hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? '処理中...' : '承認・受理する'}
                    </button>
                    <button
                      onClick={handleReject}
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
    </div>
  );
}

