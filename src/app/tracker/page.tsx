'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Search,
  Filter,
  MoreHorizontal,
  ChevronRight,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  History,
  X,
  FileText,
  MessageSquare
} from 'lucide-react';
import { getDataProvider } from '@/lib/repository/factory';
import { Task, AuditLog } from '@/lib/repository/types';
import { useAuth } from '@/context/auth-context';
import { ClientOnlyDate } from '@/components/common/client-only-date';

export default function ProgressTracker() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    const fetchTasks = async () => {
      if (!user) return;
      const provider = getDataProvider();
      const allTasks = await provider.getTasks();
      const myRequests = allTasks.filter(t => t.requesterId === user.id);
      setTasks(myRequests);
    };
    fetchTasks();
  }, [user]);

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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#191714]">自分の依頼状況</h1>
        <p className="text-slate-500 font-medium">これまでに提出した申請の進捗状況を確認できます。</p>
      </header>

      {/* Grid of Tasks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tasks.map((task) => (
          <div 
            key={task.id} 
            onClick={() => setSelectedTask(task)}
            className="group bg-white p-6 rounded-3xl border border-slate-200 notion-shadow hover:border-slate-900 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{task.category}</span>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight shadow-sm",
                task.status === 'completed' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                task.status === 'in_progress' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                "bg-slate-50 text-slate-400 border border-slate-100"
              )}>
                {getStatusLabel(task.status)}
              </span>
            </div>
            <h3 className="text-lg font-bold text-[#191714] mb-4 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
              {task.title}
            </h3>
            
            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                  <Clock className="w-3 h-3 text-slate-400" />
                </div>
                <span className="text-[10px] font-bold text-slate-400">完了予定日 04/15</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-900 transform group-hover:translate-x-1 transition-all" />
            </div>

            {/* Overdue Indicator */}
            {new Date(task.dueDate) < new Date() && task.status !== 'completed' && (
              <div className="absolute top-0 right-0 p-1">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-sm shadow-rose-200" />
              </div>
            )}
          </div>
        ))}
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
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Task Trace</div>
                  <div className="text-sm font-bold text-[#191714]">進捗トラッカー</div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTask(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-900"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-10 space-y-12">
              <header className="space-y-6">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-slate-100 border text-[10px] font-black text-slate-500 uppercase tracking-widest">{selectedTask.category}</span>
                  <span className="text-[10px] font-bold text-slate-300">ID: {selectedTask.id}</span>
                </div>
                <h1 className="text-4xl font-black tracking-tight text-[#191714] leading-tight">
                  {selectedTask.title}
                </h1>
                <div className="flex items-center gap-8 py-6 border-y border-slate-100">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">現在のステータス</div>
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-blue-500" />
                       <span className="text-sm font-black text-blue-600 uppercase tracking-widest">{getStatusLabel(selectedTask.status)}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">目標完了日 (SLA)</div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-300" />
                      <span className="text-sm font-bold text-[#191714]"><ClientOnlyDate date={selectedTask.dueDate} /></span>
                    </div>
                  </div>
                </div>
              </header>

              <section className="space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  申請内容の要約
                </h3>
                <div className="text-sm font-medium text-slate-600 leading-relaxed bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                  {selectedTask.description || <span className="text-slate-400 italic">追加の説明はありません。</span>}
                </div>
                
                {/* Dynamic Form Custom Data Rendering */}
                {selectedTask.customData && Object.keys(selectedTask.customData).length > 0 && (
                  <div className="mt-6 space-y-4 bg-white p-6 rounded-2xl border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">申請時の入力データ</h4>
                    <div className="grid grid-cols-2 gap-y-4">
                      {Object.entries(selectedTask.customData).map(([key, value]) => (
                        <div key={key} className="space-y-1">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{key}</div>
                          <div className="text-sm font-bold text-[#191714]">{value as string}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Approval Route Visual */}
              <section className="space-y-8">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  承認の軌跡
                </h3>
                <div className="space-y-4 relative pl-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {selectedTask.approvalRoute?.map((step, idx) => (
                    <div key={idx} className="relative flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-400 transition-all notion-shadow-sm group">
                      <div className={cn(
                        "absolute -left-[30px] w-5 h-5 rounded-full border-4 border-white flex items-center justify-center transition-all",
                        step.status === 'approved' ? "bg-emerald-500 scale-110" : "bg-slate-200"
                      )}>
                        {step.status === 'approved' && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex items-center gap-4">
                        <img src={step.avatar} className="w-10 h-10 rounded-xl bg-slate-100" />
                        <div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{step.position || '役職なし'}</div>
                          <div className="text-sm font-bold text-[#191714]">{step.userName}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                          step.status === 'approved' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-300 border-slate-100"
                        )}>
                          {step.status === 'approved' ? '承認済' : '審査待ち'}
                        </span>
                        {step.status === 'approved' && <div className="text-[8px] font-bold text-slate-400 mt-1">2026/04/01 15:30</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Log History */}
              <section className="space-y-6">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <History className="w-4 h-4" />
                    アクション履歴
                  </h3>
                  <div className="space-y-4 border-l-2 border-slate-100 pl-6 ml-2">
                    {logs.map((log) => (
                      <div key={log.id} className="relative">
                        <div className="absolute -left-[31px] top-1 w-2 h-2 rounded-full bg-slate-200 ring-4 ring-white" />
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-slate-400"><ClientOnlyDate date={log.timestamp} showTime /></div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#191714]">{log.userName}</span>
                            <span className="text-xs font-medium text-slate-500">が</span>
                            <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[9px] font-bold uppercase tracking-widest">
                              {log.action === 'approved' ? '承認' : log.action === 'created' ? '申請' : log.action}
                            </span>
                            <span className="text-xs font-medium text-slate-500">しました。</span>
                          </div>
                          {log.comment && (
                            <div className="mt-2 p-3 bg-slate-50 border rounded-xl text-xs font-medium text-slate-600 italic">
                              "{log.comment}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
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
              </div>
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
