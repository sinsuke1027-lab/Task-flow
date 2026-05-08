'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import {
  Search,
  Filter,
  MoreHorizontal,
  X,
  Download,
} from 'lucide-react';
import { downloadTasksCsv, printApprovalPdf } from '@/lib/export/approval-pdf';
import { getDataProvider } from '@/lib/repository/factory';
import { Task, AuditLog, Category, Delegation } from '@/lib/repository/types';
import { useAuth } from '@/context/auth-context';
import { ClientOnlyDate } from '@/components/common/client-only-date';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useFocusTrap } from '@/hooks/useFocusTrap';

const TaskDetailPanel = dynamic(
  () => import('@/components/inbox/task-detail-panel').then(mod => mod.TaskDetailPanel),
  {
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    ),
  }
);

export default function RequestInbox() {
  const { user } = useAuth();
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

      {/* Detail Panel — next/dynamic で遅延ロード */}
      <TaskDetailPanel
        selectedTask={selectedTask}
        onClose={() => setSelectedTask(null)}
        logs={logs}
        allUsers={allUsers}
        delegations={delegations}
        user={user}
        isProcessing={isProcessing}
        commentText={commentText}
        onCommentChange={setCommentText}
        now={now}
        onApprove={handleApprove}
        onAcknowledge={handleAcknowledge}
        onReject={handleReject}
        onOpenChangeApprover={handleOpenChangeApprover}
        onExportPdf={handleExportPdf}
        onAddComment={handleAddComment}
      />
    </div>
  );
}

