'use client';

import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  User,
  Calendar,
  MessageSquare,
  History,
  ShieldCheck,
  ChevronRight,
  FileText,
  Archive,
  Copy
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getDataProvider } from '@/lib/repository/factory';
import { Task, AuditLog } from '@/lib/repository/types';
import { useAuth } from '@/context/auth-context';
import { ClientOnlyDate } from '@/components/common/client-only-date';
import { cn } from '@/lib/utils';

export default function RequestInbox() {
  const { user } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'overdue' | 'completed'>('all');
  const [commentText, setCommentText] = useState('');

  const now = new Date('2026-04-02T09:05:57Z'); // For consistent testing matching current metadata

  useEffect(() => {
    const fetchTasks = async () => {
      const provider = getDataProvider();
      const allTasks = await provider.getTasks();
      setTasks(allTasks);
      if (allTasks.length > 0) setSelectedTask(allTasks[0]);
    };
    fetchTasks();
  }, []);

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

    return baseTasks.filter(t => {
      const isOverdue = new Date(t.dueDate) < now && t.status !== 'completed';
      
      if (filter === 'all') return true;
      if (filter === 'overdue') return isOverdue;
      if (filter === 'completed') return t.status === 'completed';
      
      if (!isAdmin) {
        // Nakamura TL / Takahashi GM logic: "My Turn"
        if (filter === 'todo') return t.currentApproverId === user.id && !isOverdue;
        if (filter === 'in_progress') {
          const myStepIndex = t.approvalRoute.findIndex(s => s.userId === user.id);
          const myStep = t.approvalRoute[myStepIndex];
          const isAfterMe = t.approvalRoute.slice(myStepIndex + 1).some(s => s.status === 'pending');
          return myStep?.status === 'approved' && isAfterMe;
        }
      } else {
        // Admin logic: Simple status filter
        return t.status === filter && !isOverdue;
      }
      return false;
    });
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
      {/* List Panel */}
      <div className="w-96 flex flex-col border-r bg-[#FBFBFA]/50">
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[#191714] uppercase tracking-widest">依頼一覧</h2>
            <div className="flex items-center gap-1">
              <button className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                <Filter className="w-4 h-4 text-slate-400" />
              </button>
              <button className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                <MoreHorizontal className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-300" />
            <input 
              type="text" 
              placeholder="依頼を検索..."
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
                    isActive ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
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
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{task.category}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight",
                    isOverdue ? "bg-rose-100 text-rose-600" :
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
                  <span className="text-[9px] font-bold text-slate-400">現在：</span>
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
                    <span className="text-[10px] font-bold text-slate-400">{task.requesterId.split('_').pop()}</span>
                  </div>
                  <div className={cn(
                    "text-[10px] font-bold ml-auto",
                    isOverdue ? "text-rose-500" : "text-slate-300"
                  )}>
                    <ClientOnlyDate date={task.dueDate} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="flex-1 overflow-y-auto bg-white p-10">
        {selectedTask ? (
          <div className="max-w-3xl space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
            <header className="space-y-6">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-slate-100 border text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {selectedTask.category}
                </span>
                <span className="text-[10px] font-bold text-slate-300">ID: {selectedTask.id}</span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-[#191714] leading-tight">
                {selectedTask.title}
              </h1>
              <div className="flex items-center gap-8 py-4 border-y border-slate-100">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">申請者</div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold">U</div>
                    <span className="text-xs font-bold text-[#191714]">User {selectedTask.requesterId.split('_').pop()}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">期限 (SLA)</div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-300" />
                    <span className="text-xs font-bold text-[#191714]"><ClientOnlyDate date={selectedTask.dueDate} /></span>
                  </div>
                </div>
              </div>
            </header>

            <section className="space-y-4">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4" />
                依頼内容の詳細
              </h3>
              <div className="text-sm font-medium text-slate-600 leading-relaxed bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                {selectedTask.description || <span className="text-slate-400 italic">追加の説明はありません。</span>}
              </div>
              
              {/* Dynamic Form Custom Data Rendering */}
              {selectedTask.customData && Object.keys(selectedTask.customData).length > 0 && (
                <div className="mt-6 space-y-4 bg-white p-6 rounded-2xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">追加フォーム入力内容</h4>
                  <div className="grid grid-cols-2 gap-y-4">
                    {Object.entries(selectedTask.customData).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{key}</div>
                        <div className="text-sm font-bold text-[#191714]">{value as string}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Approval Route Visual */}
            <section className="space-y-6">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                現在の承認ステータス
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedTask.approvalRoute?.map((step, idx) => (
                  <div key={idx} className="relative p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-400 transition-all notion-shadow group">
                    <div className="absolute top-3 right-3">
                      {step.status === 'approved' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-200" />
                      )}
                    </div>
                    <img 
                      src={step.avatar} 
                      alt={step.userName}
                      className="w-10 h-10 rounded-xl bg-slate-100 mb-3" 
                    />
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{step.position}</div>
                    <div className="text-xs font-bold text-[#191714]">{step.userName}</div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                        step.status === 'approved' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100"
                      )}>
                        {step.status === 'approved' ? '承認済' : '待機中'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* CC Users Compact Display */}
              {selectedTask.ccRoute && selectedTask.ccRoute.length > 0 && (
                <div className="pt-2 animate-in fade-in duration-500">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CC（共有先）</div>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.ccRoute.map((cc, idx) => (
                      <div key={idx} className="flex items-center gap-2 pl-1 pr-3 py-1 bg-slate-50 border border-slate-100 rounded-full hover:bg-slate-100 transition-colors group cursor-default">
                        <img 
                          src={cc.avatar} 
                          alt={cc.userName}
                          className="w-5 h-5 rounded-full bg-slate-200" 
                        />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-[#191714] leading-tight">{cc.userName}</span>
                          <span className="text-[8px] font-medium text-slate-400 leading-tight uppercase tracking-tighter">{cc.position}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Audit Logs (Timeline) */}
            <section className="space-y-6">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
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
                          <div className="text-[10px] font-bold text-slate-300">
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
                  <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic py-4">履歴データはまだありません</div>
                )}
              </div>
            </section>

            {/* In-App Messaging (Comments) */}
            <section className="space-y-6 pt-4 border-t">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                連絡・コメントを追加
              </h3>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold shrink-0">
                  {user?.avatar ? <img src={user.avatar} className="w-full h-full rounded-full" alt="avatar" /> : 'U'}
                </div>
                <div className="flex-1 space-y-3">
                  <textarea 
                    rows={3}
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

            <footer className="pt-10 flex items-center gap-4">
              {selectedTask.status === 'completed' ? (
                <button 
                  onClick={() => router.push(`/request?reuseTaskId=${selectedTask.id}`)}
                  className="flex-1 py-4 bg-slate-900 mx-auto text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all hover:shadow-xl hover:-translate-y-1"
                >
                  <Copy className="w-5 h-5" />
                  再利用して申請
                </button>
              ) : (
                <>
                  <button className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all hover:shadow-xl hover:-translate-y-1">
                    承認・受理する
                  </button>
                  <button className="px-8 py-4 bg-white border border-slate-200 text-rose-600 rounded-2xl font-bold hover:bg-rose-50 hover:border-rose-200 transition-all">
                    差し戻し
                  </button>
                </>
              )}
            </footer>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-300">
            <Archive className="w-16 h-16 opacity-10 mb-4" />
            <p className="text-sm font-bold uppercase tracking-widest opacity-30">依頼を選択してください</p>
          </div>
        )}
      </div>
    </div>
  );
}

