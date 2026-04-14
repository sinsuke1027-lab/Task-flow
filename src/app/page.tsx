'use client';

import { 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  Plus,
  BarChart3,
  ChevronRight,
  Calendar,
  Filter,
  TreeDeciduous,
  Check,
  RotateCcw,
  AlertTriangle,
  Zap,
} from 'lucide-react';

import { getDataProvider } from '@/lib/repository/factory';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Task, User, OrganizationUnit, Department } from '@/lib/repository/types';
import { useAuth } from '@/context/auth-context';
import Link from 'next/link';
import { OrgNode } from '@/components/organization/org-node';
import { ClientOnlyDate } from '@/components/common/client-only-date';

export default function Dashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrganizationUnit[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('all');

  // Role Flags
  const isSystemAdmin = user?.role === 'admin';
  const isManagement = ['President', 'Division Manager', 'General Manager', 'Team Leader'].includes(user?.position || '');
  const isMember = !isSystemAdmin && !isManagement;

  const fetchData = useCallback(async () => {
    const provider = getDataProvider();
    const [t, u, o, d] = await Promise.all([
      provider.getTasks(),
      provider.getUsers(),
      provider.getOrganizationUnits(),
      provider.getDepartments()
    ]);
    setTasks(t);
    setAllUsers(u);
    setOrgUnits(o);
    setDepartments(d);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (taskId: string) => {
    const provider = getDataProvider();
    try {
      await provider.processApproval(taskId, user!.id, 'approve', 'ダッシュボードからのクイック承認');
      await fetchData();
    } catch (error) {
      console.error('Approval failed:', error);
    }
  };

  const handleReject = async (taskId: string) => {
    const provider = getDataProvider();
    try {
      await provider.processApproval(taskId, user!.id, 'reject', 'ダッシュボードからのクイック差戻し');
      await fetchData();
    } catch (error) {
      console.error('Rejection failed:', error);
    }
  };

  // フィルタリング後のタスク
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (startDate && new Date(t.createdAt) < new Date(startDate)) return false;
      if (endDate && new Date(t.createdAt) > new Date(endDate)) return false;
      if (selectedDeptId !== 'all' && t.targetDepartmentId !== selectedDeptId) return false;
      return true;
    });
  }, [tasks, startDate, endDate, selectedDeptId]);

  // 滞留集計
  const stagnationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTasks.forEach(t => {
      if (t.status !== 'completed' && t.currentApproverId) {
        counts[t.currentApproverId] = (counts[t.currentApproverId] || 0) + 1;
      }
    });
    return counts;
  }, [filteredTasks]);

  const leadTimeStats = useMemo(() => {
    const now = new Date();
    const stats = { safe: 0, warning: 0, alert: 0 };
    filteredTasks.forEach(t => {
      if (t.status !== 'completed') {
        const diffTime = Math.abs(now.getTime() - new Date(t.createdAt).getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) stats.alert++;
        else if (diffDays >= 3) stats.warning++;
        else stats.safe++;
      }
    });
    return stats;
  }, [filteredTasks]);

  const myTurnTasks = tasks.filter(t => t.currentApproverId === user?.id && t.status !== 'completed');
  const myPendingRequests = tasks.filter(t => t.requesterId === user?.id && t.status !== 'completed');

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      {/* Header Section */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-blue-600">
          <ArrowUpRight className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {isSystemAdmin ? 'System Oversight' : isManagement ? 'Management Dashboard' : 'Personal Workspace'}
          </span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-[#191714]">
          {isSystemAdmin ? '組織滞留モニタリング' : isMember ? '提案事項' : 'マネジメント・インサイト'}
        </h1>
        <p className="text-slate-500 font-medium">
          お疲れ様です、{user?.name}さん。{isSystemAdmin ? '現在の組織全体の状況です。' : isManagement ? '組織のパフォーマンスとアクションアイテムを確認します。' : 'あなたに関連する最新のアクションです。'}
        </p>
      </header>

      {/* Monitoring Visualization Section (Admin & Management) */}
      {(isSystemAdmin || isManagement) && (
        <div className="space-y-8">
          {/* Advanced Filters */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 notion-shadow flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-slate-400" />
              <div className="flex items-center gap-2">
                <input type="date" className="text-xs font-bold bg-slate-50 border rounded-lg px-2 py-1.5" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <span className="text-slate-300 font-bold">~</span>
                <input type="date" className="text-xs font-bold bg-slate-50 border rounded-lg px-2 py-1.5" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3 border-l pl-8">
              <Filter className="w-4 h-4 text-slate-400" />
              <select className="text-xs font-bold bg-slate-50 border rounded-lg px-4 py-1.5" value={selectedDeptId} onChange={(e) => setSelectedDeptId(e.target.value)}>
                <option value="all">すべての管理部門</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Lead Time Visualization */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatsCard icon={<Zap className="w-4 h-4" />} title="Normal (0-2d)" value={leadTimeStats.safe} color="blue" percent={(leadTimeStats.safe / (filteredTasks.filter(t => t.status !== 'completed').length || 1)) * 100} />
            <StatsCard icon={<Clock className="w-4 h-4" />} title="Warning (3-7d)" value={leadTimeStats.warning} color="amber" percent={(leadTimeStats.warning / (filteredTasks.filter(t => t.status !== 'completed').length || 1)) * 100} />
            <StatsCard icon={<AlertTriangle className="w-4 h-4" />} title="Stagnated (>7d)" value={leadTimeStats.alert} color="rose" percent={(leadTimeStats.alert / (filteredTasks.filter(t => t.status !== 'completed').length || 1)) * 100} />
          </div>
        </div>
      )}

      {/* Tree Visualization (Admin only) */}
      {isSystemAdmin && (
        <div className="bg-white rounded-3xl border border-slate-200 notion-shadow overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TreeDeciduous className="w-4 h-4 text-slate-900" />
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Organization Stagnation Tree</h3>
            </div>
          </div>
          <div className="p-8">
            {orgUnits.length > 0 && orgUnits.filter(u => u.parentId === null).map(root => (
              <OrgNode key={root.id} unit={root} allUnits={orgUnits} usersInUnit={allUsers} taskCounts={stagnationCounts} mode="stagnation" isExpandedInitial={true} />
            ))}
          </div>
        </div>
      )}

      {/* Actionable Tasks Section (Everyone) */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-[#191714] flex items-center gap-2">
            <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            対応すべき申請
          </h2>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{myTurnTasks.length}件</span>
        </div>
        
        {myTurnTasks.length > 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 notion-shadow overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">申請内容</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">申請者</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">回答期限</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myTurnTasks.map(t => (
                  <tr key={t.id} className="group hover:bg-slate-50/30 transition-all">
                    <td className="px-6 py-4">
                      <Link href={`/inbox?taskId=${t.id}`} className="block">
                        <div className="text-sm font-bold text-slate-800">{t.title}</div>
                        <div className="text-[10px] text-slate-400 line-clamp-1">{t.description}</div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <img src={allUsers.find(u => u.id === t.requesterId)?.avatar} className="w-6 h-6 rounded-lg opacity-80" />
                        <span className="text-xs font-bold text-slate-600">{allUsers.find(u => u.id === t.requesterId)?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[10px] font-black text-rose-500 flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3" />
                        <ClientOnlyDate date={t.dueDate} />
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleReject(t.id)} className="px-3 py-1.5 rounded-xl border text-[10px] font-black">差戻し</button>
                        <button onClick={() => handleApprove(t.id)} className="px-4 py-1.5 rounded-xl bg-slate-900 shadow-xl text-white text-[10px] font-black hover:bg-emerald-600">承認</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-slate-50 border p-10 rounded-3xl text-center border-dashed text-slate-400 text-xs font-bold uppercase tracking-widest">
             現在対応すべきタスクはありません。
          </div>
        )}
      </section>

      {/* My Requests Section (Everyone) */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold tracking-tight text-[#191714]">自身の申請状況と履歴</h2>
        <div className="bg-white rounded-3xl border border-slate-200 notion-shadow overflow-hidden">
          {myPendingRequests.length > 0 ? (
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">申請内容</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ステータス</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">現在の担当者</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myPendingRequests.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm mb-0.5">{task.title}</div>
                      <div className="text-[10px] font-bold text-slate-300">{new Date(task.createdAt).toLocaleDateString('ja-JP')} 提出</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-100 italic">
                        {task.status === 'in_progress' ? 'Processing' : 'Wait...'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-600">{task.currentApproverName || 'Next...'}</span>
                    </td>
                    <td className="pr-4 text-right">
                      <Link href="/tracker" className="text-slate-300 hover:text-slate-900"><ChevronRight className="w-4 h-4" /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center text-slate-300 text-xs font-bold uppercase tracking-widest">
              進行中の申請はありません。
            </div>
          )}
        </div>
      </section>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/request" className="flex items-center gap-4 p-8 bg-slate-900 text-white rounded-3xl hover:bg-black group shadow-xl">
           <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center"><Plus className="w-6 h-6" /></div>
           <div><div className="text-lg font-bold">新規依頼を作成</div><p className="text-xs text-slate-400">Apply for anything</p></div>
        </Link>
        <Link href="/tracker" className="flex items-center gap-4 p-8 bg-white border border-slate-200 rounded-3xl hover:border-slate-900 group">
           <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white"><BarChart3 className="w-6 h-6" /></div>
           <div><div className="text-lg font-bold text-slate-900">全ての履歴を確認</div><p className="text-xs text-slate-400">Audit your process</p></div>
        </Link>
      </div>
    </div>
  );
}

// Helper component for visualization stats
function StatsCard({ icon, title, value, color, percent }: { icon: any, title: string, value: number, color: string, percent: number }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-600 text-blue-600 bg-blue-50',
    amber: 'bg-amber-600 text-amber-600 bg-amber-50',
    rose: 'bg-rose-600 text-rose-600 bg-rose-50'
  };
  
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 notion-shadow flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colorMap[color].split(' ')[2]} ${colorMap[color].split(' ')[1]}`}>
            {icon}
          </div>
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{title}</h4>
        </div>
        <span className={`text-2xl font-black ${colorMap[color].split(' ')[1]}`}>{value}</span>
      </div>
      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
        <div 
          className={`${colorMap[color].split(' ')[0]} h-full transition-all duration-1000`} 
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
