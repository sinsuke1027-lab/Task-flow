'use client';

import { useState, useEffect, useCallback, useMemo, startTransition } from 'react';
import {
  ChevronRight,
  Settings,
  Users,
  ListTree,
  Shield,
  History,
  CalendarDays,
} from 'lucide-react';
import { getDataProvider } from '@/lib/repository/factory';
import { Category, OrganizationUnit, User, AuditLog, Task, Delegation } from '@/lib/repository/types';
import { cn } from '@/lib/utils';
import { AdminGeneralSection } from '@/components/admin/admin-general-section';
import { AdminOrgSection } from '@/components/admin/admin-org-section';
import { AdminCategoriesSection } from '@/components/admin/admin-categories-section';
import { AdminDelegationSection } from '@/components/admin/admin-delegation-section';
import { AdminAuditLogsSection } from '@/components/admin/admin-audit-logs-section';

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<'general' | 'org' | 'categories' | 'security' | 'logs' | 'delegation'>('general');
  const [orgUnits, setOrgUnits] = useState<OrganizationUnit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);

  const fetchData = useCallback(async () => {
    const provider = getDataProvider();
    const [units, cats, allUsers, allLogs, allTasks, allDelegations] = await Promise.all([
      provider.getOrganizationUnits(),
      provider.getCategories(),
      provider.getUsers(),
      provider.getAllAuditLogs(),
      provider.getTasks(),
      provider.getDelegations(),
    ]);
    setOrgUnits(units);
    setCategories(cats);
    setUsers(allUsers.slice(0, 50));
    setLogs(allLogs);
    setTasks(allTasks);
    setDelegations(allDelegations);
  }, []);

  useEffect(() => {
    startTransition(() => { void fetchData(); });
  }, [fetchData]);

  const adminStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const overdue = tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== 'completed').length;
    const inProgress = Math.max(0, total - completed - overdue);
    const approvalRate = total ? Math.round((completed / total) * 100) : 0;
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const avgDays = completedTasks.length
      ? Math.round(completedTasks.reduce((sum, t) => {
          return sum + (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / completedTasks.length)
      : 0;
    return { total, completed, overdue, inProgress, approvalRate, avgDays };
  }, [tasks]);

  const handleNavigateToTask = (taskId: string) => {
    localStorage.setItem('task_bridge_force_inbox_task', taskId);
  };

  const handleAddDelegation = async (params: {
    delegatorId: string; delegateId: string; startDate: string; endDate?: string; reason?: string;
  }) => {
    const provider = getDataProvider();
    await provider.createDelegation({ ...params, isActive: true });
    await fetchData();
  };

  const handleRevokeDelegation = async (id: string) => {
    const provider = getDataProvider();
    await provider.revokeDelegation(id);
    await fetchData();
  };

  const tabs = [
    { id: 'general', label: '基本設定', icon: Settings },
    { id: 'org', label: '組織・メンバー', icon: Users },
    { id: 'categories', label: '申請カテゴリー', icon: ListTree },
    { id: 'delegation', label: '代決設定', icon: CalendarDays },
    { id: 'security', label: 'セキュリティ・権限', icon: Shield },
    { id: 'logs', label: '監査ログ', icon: History },
  ] as const;

  return (
    <div className="space-y-5 animate-in fade-in duration-700">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#191714]">管理者設定</h1>
        <p className="text-slate-500 font-medium font-bold text-sm">システム全体の構成、組織マスタ、申請カテゴリーの管理を行います。</p>
      </header>

      {/* モバイル: 横スクロールタブ */}
      <div className="md:hidden flex overflow-x-auto gap-2 pb-2 no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border",
              activeTab === tab.id ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 border-slate-200 hover:border-slate-400"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-5">
        <aside className="hidden md:block w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                activeTab === tab.id ? "bg-slate-900 text-white shadow-xl translate-x-1" : "text-slate-500 hover:text-slate-600 hover:bg-slate-100"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && <ChevronRight className="w-3 h-3 ml-auto animate-in fade-in slide-in-from-left-1" />}
            </button>
          ))}
        </aside>

        <main className="flex-1 space-y-5 pb-6">
          {activeTab === 'general' && (
            <AdminGeneralSection
              adminStats={adminStats}
              tasks={tasks}
              users={users}
              now={new Date().getTime()}
            />
          )}

          {activeTab === 'org' && (
            <AdminOrgSection
              users={users}
              orgUnits={orgUnits}
              onRefetch={fetchData}
            />
          )}

          {activeTab === 'categories' && (
            <AdminCategoriesSection
              categories={categories}
              users={users}
              onRefetch={fetchData}
            />
          )}

          {activeTab === 'delegation' && (
            <AdminDelegationSection
              delegations={delegations}
              users={users}
              onRevoke={handleRevokeDelegation}
              onAdd={handleAddDelegation}
            />
          )}

          {activeTab === 'security' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <section className="bg-white rounded-3xl border border-slate-200 notion-shadow p-8 flex flex-col items-center justify-center text-center py-20">
                <Shield className="w-12 h-12 text-slate-200 mb-4" />
                <h2 className="text-xl font-bold text-[#191714]">セキュリティ・権限設定</h2>
                <p className="text-sm text-slate-500 max-w-sm">システム権限ロールやIP制限の設定は、現在準備中です。プロトタイプ版ではデフォルトのRoleBasedPolicyが適用されています。</p>
              </section>
            </div>
          )}

          {activeTab === 'logs' && (
            <AdminAuditLogsSection
              logs={logs}
              onNavigateToTask={handleNavigateToTask}
            />
          )}
        </main>
      </div>
    </div>
  );
}
