'use client';

import { useState } from 'react';
import { Search, Filter, MoreHorizontal, Download } from 'lucide-react';
import { Task, Category, User } from '@/lib/repository/types';
import { ClientOnlyDate } from '@/components/common/client-only-date';
import { downloadTasksCsv } from '@/lib/export/approval-pdf';
import { cn } from '@/lib/utils';

interface TaskListPanelProps {
  tasks: Task[];
  selectedTask: Task | null;
  user: User | null;
  categories: Category[];
  allUsers: User[];
  now: Date;
  onSelectTask: (task: Task) => void;
}

export function TaskListPanel({
  tasks,
  selectedTask,
  user,
  categories,
  allUsers,
  now,
  onSelectTask,
}: TaskListPanelProps) {
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'overdue' | 'completed'>('all');
  const [inboxSearchQuery, setInboxSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'normal' | 'high'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const getFilteredTasks = () => {
    if (!user) return [];

    let baseTasks = tasks;
    const isAdmin = user.role === 'admin' || user.departmentId === 'dept_admin';

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

    if (inboxSearchQuery.trim()) {
      const q = inboxSearchQuery.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q)
      );
    }

    if (periodFilter !== 'all') {
      const cutoff = new Date(now);
      if (periodFilter === 'today') cutoff.setHours(0, 0, 0, 0);
      else if (periodFilter === 'week') cutoff.setDate(cutoff.getDate() - 7);
      else if (periodFilter === 'month') cutoff.setMonth(cutoff.getMonth() - 1);
      result = result.filter(t => new Date(t.createdAt) >= cutoff);
    }

    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter);
    }

    if (categoryFilter !== 'all') {
      result = result.filter(t => t.categoryId === categoryFilter);
    }

    return [...result].sort((a, b) => {
      if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortOrder === 'title') return a.title.localeCompare(b.title, 'ja');
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  const filteredTasks = getFilteredTasks();

  const getStatusLabel = (status: string) => {
    const mapping: Record<string, string> = {
      'todo': '未着手', 'in_progress': '対応中', 'completed': '完了済み', 'overdue': '期限超過',
    };
    return mapping[status] || status;
  };

  const handleExportCsv = () => {
    const date = new Date().toISOString().split('T')[0];
    downloadTasksCsv(filteredTasks, allUsers, `inbox_${date}.csv`);
  };

  return (
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
                      <button key={opt.value} onClick={() => setPeriodFilter(opt.value)}
                        className={cn("w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-slate-50", periodFilter === opt.value ? "text-blue-600 bg-blue-50" : "text-slate-600")}
                      >{opt.label}</button>
                    ))}
                    <div className="px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-y mt-1">優先度</div>
                    {([
                      { value: 'all', label: 'すべて' },
                      { value: 'high', label: '急ぎ' },
                      { value: 'normal', label: '通常' },
                      { value: 'low', label: '低' },
                    ] as const).map(opt => (
                      <button key={opt.value} onClick={() => setPriorityFilter(opt.value)}
                        className={cn("w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-slate-50", priorityFilter === opt.value ? "text-blue-600 bg-blue-50" : "text-slate-600")}
                      >{opt.label}</button>
                    ))}
                    {categories.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-y mt-1">カテゴリー</div>
                        <button onClick={() => setCategoryFilter('all')}
                          className={cn("w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-slate-50", categoryFilter === 'all' ? "text-blue-600 bg-blue-50" : "text-slate-600")}
                        >すべて</button>
                        {categories.map(cat => (
                          <button key={cat.id} onClick={() => setCategoryFilter(cat.id)}
                            className={cn("w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-slate-50 truncate", categoryFilter === cat.id ? "text-blue-600 bg-blue-50" : "text-slate-600")}
                          >{cat.name}</button>
                        ))}
                      </>
                    )}
                    <div className="px-3 py-2 border-t">
                      <button
                        onClick={() => { setPeriodFilter('all'); setPriorityFilter('all'); setCategoryFilter('all'); setShowFilterDropdown(false); }}
                        className="w-full text-center text-[10px] font-black text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-widest"
                      >リセット</button>
                    </div>
                  </div>
                </>
              )}
            </div>
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
                      <button key={opt.value} onClick={() => { setSortOrder(opt.value); setShowSortDropdown(false); }}
                        className={cn("w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-slate-50", sortOrder === opt.value ? "text-slate-900 bg-slate-50" : "text-slate-600")}
                      >{opt.label}</button>
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
              >{label}</button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100/50">
        {filteredTasks.map((task) => {
          const isOverdue = new Date(task.dueDate) < now && task.status !== 'completed';
          return (
            <button
              key={task.id}
              onClick={() => onSelectTask(task)}
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
                  <div className={cn("text-[10px] font-bold", isOverdue ? "text-rose-700" : "text-slate-500")}>
                    <ClientOnlyDate date={task.dueDate} />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
