'use client';

import { useState, useEffect, useCallback, useRef, useMemo, startTransition } from 'react';
import dynamic from 'next/dynamic';
import { 
  ChevronRight,
  Plus,
  MoreHorizontal,
  ListTree,
  Save,
  Trash2,
  Clock,
  CheckCircle2,
  Settings,
  Users,
  Shield,
  Globe,
  RefreshCw,
  Upload,
  CalendarDays,
  History,
  Search,
  FileText,
  Download
} from 'lucide-react';
import { getDataProvider } from '@/lib/repository/factory';
import { mockProvider } from '@/lib/repository/mock-provider';
import { Category, OrganizationUnit, User, AuditLog, Task, Delegation, AmountRule, CustomField, WorkflowStepTemplate } from '@/lib/repository/types';
import { downloadTasksCsv } from '@/lib/export/approval-pdf';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ClientOnlyDate } from '@/components/common/client-only-date';
import { useFocusTrap } from '@/hooks/useFocusTrap';

const CategoryFormModal = dynamic(
  () => import('@/components/admin/category-form-modal').then(mod => mod.CategoryFormModal),
  {
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="w-10 h-10 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    ),
  }
);

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<'general' | 'org' | 'categories' | 'security' | 'logs' | 'delegation'>('general');
  const [orgUnits, setOrgUnits] = useState<OrganizationUnit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  
  // Logs Search & Filter
  const [logSearchQuery, setLogSearchQuery] = useState('');
  
  // Modal State — 人事・組織変更
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [changeType, setChangeType] = useState<'transfer' | 'retire' | 'leave' | 'promotion'>('transfer');
  const [newManager, setNewManager] = useState<string>('');
  const [newOrgUnit, setNewOrgUnit] = useState<string>('');

  // General 設定を保存
  const [tenantName, setTenantName] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('tb_tenant_name') || '株式会社デジタルフォルン (Task Flow)';
    return '株式会社デジタルフォルン (Task Flow)';
  });
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // 一括インポート
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<{ count: number; errors: string[] } | null>(null);

  // ユーザー新規追加
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPosition, setNewUserPosition] = useState('Member');
  const [newUserOrgUnit, setNewUserOrgUnit] = useState('');

  // ユーザー行 MoreHorizontal
  const [userMenuTargetId, setUserMenuTargetId] = useState<string | null>(null);

  // ユーザー編集・無効化
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPosition, setEditUserPosition] = useState('');
  const [editUserOrgUnit, setEditUserOrgUnit] = useState('');
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);

  // 監査ログ 日付範囲フィルター
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');

  // 組織ユニット管理
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<OrganizationUnit | null>(null);
  const [unitFormName, setUnitFormName] = useState('');
  const [unitFormType, setUnitFormType] = useState<OrganizationUnit['type']>('team');
  const [unitFormParentId, setUnitFormParentId] = useState('');

  // タスク統計
  const [tasks, setTasks] = useState<Task[]>([]);

  // 代決設定
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [showAddDelegationModal, setShowAddDelegationModal] = useState(false);
  const [delDelegatorId, setDelDelegatorId] = useState('');
  const [delDelegateId, setDelDelegateId] = useState('');
  const [delStartDate, setDelStartDate] = useState('');
  const [delEndDate, setDelEndDate] = useState('');
  const [delReason, setDelReason] = useState('');

  // カテゴリー CRUD
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [catFormTab, setCatFormTab] = useState<'basic' | 'fields' | 'workflow'>('basic');
  const [catFormName, setCatFormName] = useState('');
  const [catFormParentId, setCatFormParentId] = useState('');
  const [catFormSla, setCatFormSla] = useState(5);
  const [catFormAmountRules, setCatFormAmountRules] = useState<AmountRule[]>([]);
  const [catFormFields, setCatFormFields] = useState<CustomField[]>([]);
  const [catFormWorkflow, setCatFormWorkflow] = useState<WorkflowStepTemplate[]>([]);

  // focus trap refs for each modal
  const changeModalRef = useRef<HTMLDivElement>(null);
  const delegationModalRef = useRef<HTMLDivElement>(null);
  const addUserModalRef = useRef<HTMLDivElement>(null);
  const editUserModalRef = useRef<HTMLDivElement>(null);
  const unitModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(changeModalRef, isChangeModalOpen, () => setIsChangeModalOpen(false));
  useFocusTrap(delegationModalRef, showAddDelegationModal, () => setShowAddDelegationModal(false));
  useFocusTrap(addUserModalRef, showAddUserModal, () => setShowAddUserModal(false));
  useFocusTrap(editUserModalRef, showEditUserModal, () => { setShowEditUserModal(false); setEditingUser(null); });
  useFocusTrap(unitModalRef, showAddUnitModal || editingUnit !== null, () => { setShowAddUnitModal(false); setEditingUnit(null); });

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

  const handleApplyChange = async () => {
    if (!selectedUser) return;
    
    const provider = getDataProvider();
    const changes: Record<string, unknown> = {};
    
    if (changeType === 'transfer' || changeType === 'promotion') {
      if (newOrgUnit) changes.orgUnitId = newOrgUnit;
      if (newManager) changes.managerId = newManager;
    } else if (changeType === 'retire') {
      changes.status = 'inactive';
      changes.leftAt = new Date().toISOString();
    } else if (changeType === 'leave') {
      changes.status = 'on_leave';
    }

    const event = await provider.scheduleUserChange({
      targetType: 'user',
      targetId: selectedUser,
      eventType: changeType,
      scheduledAt: new Date().toISOString(),
      changes: changes,
      note: 'Admin manual update'
    });

    await provider.applyUserChange(event.id);
    setIsChangeModalOpen(false);
    await fetchData();
  };

  const handleSaveSettings = () => {
    localStorage.setItem('tb_tenant_name', tenantName);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const provider = getDataProvider();
    const result = await provider.importBulkData('users', text);
    setImportResult(result);
    await fetchData();
    e.target.value = '';
  };

  const handleAddUser = async () => {
    if (!newUserName || !newUserEmail) return;
    const provider = getDataProvider();
    await provider.createUser({
      name: newUserName,
      email: newUserEmail,
      role: 'user',
      position: newUserPosition,
      orgUnitId: newUserOrgUnit || (orgUnits[0]?.id ?? ''),
      departmentId: '',
      managerId: null,
      status: 'active',
      joinedAt: new Date().toISOString(),
    });
    setShowAddUserModal(false);
    setNewUserName(''); setNewUserEmail(''); setNewUserPosition('Member'); setNewUserOrgUnit('');
    await fetchData();
  };

  const handleSaveCategory = async () => {
    if (!catFormName) return;
    const provider = getDataProvider();
    const validRules = catFormAmountRules.filter(r => r.fieldLabel && r.minAmount > 0 && r.requiredPosition);
    const payload = {
      name: catFormName,
      parentId: catFormParentId || null,
      slaDays: catFormSla,
      amountRules: validRules,
      customFields: catFormFields,
      workflowTemplate: catFormWorkflow,
    };
    if (editingCategory) {
      await provider.updateCategory(editingCategory.id, payload);
      setEditingCategory(null);
    } else {
      await provider.createCategory({ ...payload, targetDepartmentId: 'dept_admin' });
      setShowAddCatModal(false);
    }
    setCatFormName(''); setCatFormParentId(''); setCatFormSla(5); setCatFormAmountRules([]);
    setCatFormFields([]); setCatFormWorkflow([]); setCatFormTab('basic');
    await fetchData();
  };

  const handleNavigateToTask = (taskId: string) => {
    localStorage.setItem('task_bridge_force_inbox_task', taskId);
  };

  const handleEditUser = async () => {
    if (!editingUser || !editUserName || !editUserEmail) return;
    const provider = getDataProvider();
    await provider.updateUser(editingUser.id, {
      name: editUserName,
      email: editUserEmail,
      position: editUserPosition,
      orgUnitId: editUserOrgUnit || editingUser.orgUnitId,
    });
    setShowEditUserModal(false);
    setEditingUser(null);
    await fetchData();
  };

  const handleDeactivateUser = async () => {
    if (!deactivatingUser) return;
    const provider = getDataProvider();
    await provider.updateUser(deactivatingUser.id, {
      status: 'inactive',
      leftAt: new Date().toISOString(),
    });
    setDeactivatingUser(null);
    await fetchData();
  };

  const handleSaveUnit = async () => {
    if (!unitFormName) return;
    const provider = getDataProvider();
    if (editingUnit) {
      await provider.updateOrganizationUnit(editingUnit.id, { name: unitFormName, type: unitFormType, parentId: unitFormParentId || null });
      setEditingUnit(null);
    } else {
      await provider.createOrganizationUnit({ name: unitFormName, type: unitFormType, parentId: unitFormParentId || null, status: 'active' });
      setShowAddUnitModal(false);
    }
    setUnitFormName(''); setUnitFormType('team'); setUnitFormParentId('');
    await fetchData();
  };

  const handleArchiveUnit = async (unitId: string) => {
    const provider = getDataProvider();
    await provider.archiveOrganizationUnit(unitId);
    await fetchData();
  };

  // 監査ログ フィルタリング (検索 + 日付範囲)
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

  // 管理者統計
  const adminStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const overdue = tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== 'completed').length;
    const inProgress = total - completed - overdue < 0 ? 0 : total - completed - overdue;
    const approvalRate = total ? Math.round((completed / total) * 100) : 0;
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const avgDays = completedTasks.length
      ? Math.round(completedTasks.reduce((sum, t) => {
          const diff = new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime();
          return sum + diff / (1000 * 60 * 60 * 24);
        }, 0) / completedTasks.length)
      : 0;
    return { total, completed, overdue, inProgress, approvalRate, avgDays };
  }, [tasks]);

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    const provider = getDataProvider();
    await provider.deleteCategory(deletingCategory.id);
    setDeletingCategory(null);
    await fetchData();
  };

  const handleAddDelegation = async () => {
    if (!delDelegatorId || !delDelegateId || !delStartDate) return;
    const provider = getDataProvider();
    await provider.createDelegation({
      delegatorId: delDelegatorId,
      delegateId: delDelegateId,
      startDate: delStartDate,
      endDate: delEndDate || undefined,
      reason: delReason || undefined,
      isActive: true,
    });
    setShowAddDelegationModal(false);
    setDelDelegatorId(''); setDelDelegateId(''); setDelStartDate(''); setDelEndDate(''); setDelReason('');
    await fetchData();
  };

  const handleRevokeDelegation = async (id: string) => {
    if (!confirm('この代決設定を無効化しますか？')) return;
    const provider = getDataProvider();
    await provider.revokeDelegation(id);
    await fetchData();
  };

  const now = new Date().getTime();

  return (
    <div className="space-y-5 animate-in fade-in duration-700">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#191714]">管理者設定</h1>
        <p className="text-slate-500 font-medium font-bold text-sm">システム全体の構成、組織マスタ、申請カテゴリーの管理を行います。</p>
      </header>

      {/* モバイル: 横スクロールタブ / デスクトップ: サイドバー */}
      <div className="md:hidden flex overflow-x-auto gap-2 pb-2 no-scrollbar">
        {[
          { id: 'general', label: '基本設定', icon: Settings },
          { id: 'org', label: '組織・メンバー', icon: Users },
          { id: 'categories', label: '申請カテゴリー', icon: ListTree },
          { id: 'delegation', label: '代決設定', icon: CalendarDays },
          { id: 'security', label: 'セキュリティ', icon: Shield },
          { id: 'logs', label: '監査ログ', icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border",
              activeTab === tab.id
                ? "bg-slate-900 text-white border-slate-900"
                : "text-slate-500 border-slate-200 hover:border-slate-400"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-5">
        <aside className="hidden md:block w-64 space-y-1">
          {[
            { id: 'general', label: '基本設定', icon: Settings },
            { id: 'org', label: '組織・メンバー', icon: Users },
            { id: 'categories', label: '申請カテゴリー', icon: ListTree },
            { id: 'delegation', label: '代決設定', icon: CalendarDays },
            { id: 'security', label: 'セキュリティ・権限', icon: Shield },
            { id: 'logs', label: '監査ログ', icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                activeTab === tab.id
                  ? "bg-slate-900 text-white shadow-xl translate-x-1"
                  : "text-slate-500 hover:text-slate-600 hover:bg-slate-100"
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
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* 統計カード */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: '全申請数', value: adminStats.total, sub: 'Total Tasks', color: 'text-slate-900' },
                  { label: '完了済み', value: adminStats.completed, sub: 'Completed', color: 'text-emerald-600' },
                  { label: '処理中', value: adminStats.inProgress, sub: 'In Progress', color: 'text-blue-600' },
                  { label: '期限超過', value: adminStats.overdue, sub: 'Overdue', color: 'text-rose-600' },
                  { label: '承認率', value: `${adminStats.approvalRate}%`, sub: 'Approval Rate', color: 'text-violet-600' },
                  { label: '平均処理日数', value: `${adminStats.avgDays}日`, sub: 'Avg. Lead Time', color: 'text-amber-600' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white border border-slate-200 rounded-2xl notion-shadow p-3 space-y-1">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</div>
                    <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{stat.sub}</div>
                  </div>
                ))}
              </div>

              <section className="bg-white rounded-3xl border border-slate-200 notion-shadow p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#191714]">システム基本情報</h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">General System Settings</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadTasksCsv(tasks, users, 'all-tasks.csv')}
                      disabled={tasks.length === 0}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Download className="w-4 h-4" />
                      全タスク CSV
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm('モックデータをJSON初期値にリセットします。現在の変更はすべて失われます。よろしいですか？')) return;
                        mockProvider.clearStorage();
                        window.location.reload();
                      }}
                      className="flex items-center gap-2 px-4 py-2 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-50 transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                      データをリセット
                    </button>
                    <button
                      onClick={handleSaveSettings}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
                    >
                      <Save className="w-4 h-4" />
                      設定を保存
                    </button>
                  </div>
                </div>
                {showSaveSuccess && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 animate-in slide-in-from-top-2 duration-300">
                    <CheckCircle2 className="w-4 h-4" /> 設定を保存しました
                  </div>
                )}
                <div className="grid grid-cols-2 gap-8 pt-4">
                  <div className="space-y-2">
                    <label htmlFor="admin-tenant-name" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">テナント名</label>
                    <input
                      id="admin-tenant-name"
                      type="text"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      className="w-full h-10 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">データソース</label>
                    <div className="w-full h-10 px-4 bg-slate-100 border rounded-xl flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-500">SharePoint Lists (Mocked)</span>
                      <Shield className="w-4 h-4 text-emerald-500" />
                    </div>
                  </div>
                </div>
              </section>

              {/* SLA超過アラート */}
              {tasks.filter(t => t.status !== 'completed' && new Date(t.dueDate) < new Date()).length > 0 && (
                <section className="bg-white rounded-3xl border border-rose-200 notion-shadow overflow-hidden">
                  <div className="p-5 border-b border-rose-100 flex items-center justify-between bg-rose-50/50">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-rose-800">SLA 超過アラート</h3>
                        <p className="text-[10px] font-bold text-rose-700 uppercase tracking-widest">
                          {tasks.filter(t => t.status !== 'completed' && new Date(t.dueDate) < new Date()).length}件のタスクが期限を超過しています
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-rose-50">
                    {tasks
                      .filter(t => t.status !== 'completed' && new Date(t.dueDate) < new Date())
                      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                      .slice(0, 5)
                      .map(t => {
                        const overdueDays = Math.floor((now - new Date(t.dueDate).getTime()) / 86400000);
                        return (
                          <div key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-rose-50/30 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-[#191714] truncate">{t.title}</div>
                              <div className="text-[10px] font-bold text-slate-500 mt-0.5">{t.category} ／ 担当: {t.currentApproverName ?? '未設定'}</div>
                            </div>
                            <span className="shrink-0 text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                              +{overdueDays}日超過
                            </span>
                          </div>
                        );
                      })
                    }
                  </div>
                </section>
              )}

              <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">M365 Bridge 接続準備完了</h4>
                  <p className="text-xs font-medium text-amber-700 mt-0.5">現在、モックプロバイダーを使用して動作しています。Azure ADへの切り替えは「環境設定」から可能です。</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'org' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <section className="bg-white rounded-3xl border border-slate-200 notion-shadow overflow-hidden">
                <div className="p-6 border-b flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#191714]">組織・メンバー管理</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Total {users.length} Members Sampled</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsChangeModalOpen(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                      人事・組織変更
                    </button>
                    <button
                      onClick={() => importFileRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all text-slate-600"
                    >
                      <Upload className="w-4 h-4" />
                      一括インポート
                    </button>
                    <input ref={importFileRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
                    <button
                      onClick={() => setShowAddUserModal(true)}
                      className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all text-slate-600"
                    >
                      <Plus className="w-4 h-4" />
                      新規追加
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 border-b">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">氏名 / メールアドレス</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">役職</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">所属ユニット</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">ステータス</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                {u.name.charAt(0)}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-[#191714]">{u.name}</div>
                                <div className="text-[10px] font-medium text-slate-500">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-black uppercase tracking-tight bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">{u.position}</span>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-500">
                            {u.orgUnitId.split('_').pop()}
                          </td>
                          <td className="px-6 py-4">
                            {u.status === 'active' && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                有効
                              </span>
                            )}
                            {u.status === 'inactive' && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-bold border border-slate-200">
                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                無効
                              </span>
                            )}
                            {u.status === 'on_leave' && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-100">
                                <div className="w-1 h-1 rounded-full bg-amber-500" />
                                休職中
                              </span>
                            )}
                          </td>
                          <td className="pr-4 relative">
                            <button
                              onClick={() => setUserMenuTargetId(prev => prev === u.id ? null : u.id)}
                              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <MoreHorizontal className="w-4 h-4 text-slate-500" />
                            </button>
                            {userMenuTargetId === u.id && (
                              <>
                                <div className="fixed inset-0 z-[45]" onClick={() => setUserMenuTargetId(null)} />
                                <div className="absolute right-4 top-full z-50 w-44 bg-white border rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
                                  <button
                                    onClick={() => { setEditingUser(u); setEditUserName(u.name); setEditUserEmail(u.email); setEditUserPosition(u.position); setEditUserOrgUnit(u.orgUnitId); setShowEditUserModal(true); setUserMenuTargetId(null); }}
                                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
                                  >
                                    <Settings className="w-3.5 h-3.5 text-slate-500" />
                                    プロフィール編集
                                  </button>
                                  <button
                                    onClick={() => { setSelectedUser(u.id); setIsChangeModalOpen(true); setUserMenuTargetId(null); }}
                                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                                    人事・組織変更
                                  </button>
                                  {u.status === 'active' && (
                                    <button
                                      onClick={() => { setDeactivatingUser(u); setUserMenuTargetId(null); }}
                                      className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2 border-t border-slate-100"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      無効化
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 組織ユニット管理 */}
              <section className="bg-white rounded-3xl border border-slate-200 notion-shadow overflow-hidden">
                <div className="p-6 border-b flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#191714]">組織ユニット管理</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Departments & Teams</p>
                  </div>
                  <button
                    onClick={() => { setShowAddUnitModal(true); setUnitFormName(''); setUnitFormType('team'); setUnitFormParentId(''); }}
                    className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all text-slate-600"
                  >
                    <Plus className="w-4 h-4" />
                    ユニットを追加
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 border-b">
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">ユニット名</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">種別</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">親ユニット</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">ステータス</th>
                        <th className="w-24"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orgUnits.map(unit => {
                        const parent = orgUnits.find(u => u.id === unit.parentId);
                        return (
                          <tr key={unit.id} className={`hover:bg-slate-50/50 transition-colors group ${unit.status === 'archived' ? 'opacity-40' : ''}`}>
                            <td className="px-6 py-3 text-sm font-bold text-[#191714]">{unit.name}</td>
                            <td className="px-6 py-3">
                              <span className="text-[10px] font-black uppercase tracking-tight bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">{unit.type}</span>
                            </td>
                            <td className="px-6 py-3 text-xs font-bold text-slate-500">{parent?.name || '—'}</td>
                            <td className="px-6 py-3">
                              {unit.status === 'active'
                                ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">有効</span>
                                : <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">アーカイブ</span>
                              }
                            </td>
                            <td className="pr-4 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                  onClick={() => { setEditingUnit(unit); setUnitFormName(unit.name); setUnitFormType(unit.type); setUnitFormParentId(unit.parentId || ''); }}
                                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-all"
                                >
                                  <Settings className="w-3.5 h-3.5" />
                                </button>
                                {unit.status === 'active' && (
                                  <button
                                    onClick={() => handleArchiveUnit(unit.id)}
                                    className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-300 hover:text-rose-600 transition-all"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <section className="bg-white rounded-3xl border border-slate-200 notion-shadow overflow-hidden">
                <div className="p-6 border-b flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#191714]">申請カテゴリーマスタ</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Configure SLA and Approval Templates</p>
                  </div>
                  <button
                    onClick={() => { setShowAddCatModal(true); setCatFormName(''); setCatFormParentId(''); setCatFormSla(5); setCatFormAmountRules([]); setCatFormFields([]); setCatFormWorkflow([]); setCatFormTab('basic'); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    カテゴリを追加
                  </button>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categories.filter(c => c.parentId !== null).map((cat) => {
                    const parent = categories.find(p => p.id === cat.parentId);
                    return (
                      <div key={cat.id} className="p-4 bg-slate-50 border rounded-2xl flex items-center justify-between hover:border-slate-900 transition-all cursor-pointer group">
                        <div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{parent?.name || '基本カテゴリ'}</div>
                          <div className="text-sm font-bold text-[#191714]">{cat.name}</div>
                          <div className="mt-2 flex items-center gap-2">
                            <Clock className="w-3 h-3 text-emerald-500" />
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">目標SLA: {cat.slaDays}日</span>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); setCatFormName(cat.name); setCatFormParentId(cat.parentId || ''); setCatFormSla(cat.slaDays ?? 5); setCatFormAmountRules(cat.amountRules ?? []); setCatFormFields(cat.customFields ?? []); setCatFormWorkflow(cat.workflowTemplate ?? []); setCatFormTab('basic'); }}
                            className="p-2 hover:bg-white rounded-lg text-slate-500 border border-transparent hover:border-slate-200 transition-all"
                          ><Settings className="w-3.5 h-3.5" /></button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeletingCategory(cat); }}
                            className="p-2 hover:bg-rose-50 rounded-lg text-rose-300 hover:text-rose-600 border border-transparent hover:border-rose-100 transition-all"
                          ><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'delegation' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <section className="bg-white rounded-3xl border border-slate-200 notion-shadow p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-black text-[#191714]">代決設定</h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">不在時などに代理で承認できるユーザーを設定します。</p>
                  </div>
                  <button
                    onClick={() => setShowAddDelegationModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    代決を追加
                  </button>
                </div>
                <div className="space-y-2">
                  {delegations.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-8">代決設定はありません</p>
                  )}
                  {delegations.map(d => {
                    const delegator = users.find(u => u.id === d.delegatorId);
                    const delegate = users.find(u => u.id === d.delegateId);
                    return (
                      <div key={d.id} className={cn("flex items-center gap-4 p-4 rounded-2xl border transition-all", d.isActive ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100 opacity-60")}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-800">{delegator?.name ?? d.delegatorId}</span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">→ 代理:</span>
                            <span className="text-sm font-bold text-violet-700">{delegate?.name ?? d.delegateId}</span>
                            {!d.isActive && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black rounded-full uppercase">無効</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-slate-500 font-medium">{d.startDate} 〜 {d.endDate ?? '終了日なし'}</span>
                            {d.reason && <span className="text-[10px] text-slate-500 font-medium truncate max-w-xs">{d.reason}</span>}
                          </div>
                        </div>
                        {d.isActive && (
                          <button
                            onClick={() => handleRevokeDelegation(d.id)}
                            className="px-3 py-1.5 text-[10px] font-black text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                          >
                            無効化
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 代決追加モーダル */}
              {showAddDelegationModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAddDelegationModal(false)} aria-hidden="true" />
                  <div
                    ref={delegationModalRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delegation-modal-title"
                    className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
                  >
                    <div className="p-6 border-b flex items-center justify-between">
                      <h3 id="delegation-modal-title" className="text-lg font-bold text-[#191714]">代決設定を追加</h3>
                      <button type="button" onClick={() => setShowAddDelegationModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="閉じる">
                        <X className="w-5 h-5 text-slate-500" />
                      </button>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="space-y-1">
                        <label htmlFor="del-delegator" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">権限を委任する人（不在者）<span className="text-rose-600">*</span></label>
                        <select
                          id="del-delegator"
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-slate-900 transition-all"
                          value={delDelegatorId}
                          onChange={e => setDelDelegatorId(e.target.value)}
                        >
                          <option value="">選択してください</option>
                          {users.filter(u => u.status === 'active').map(u => (
                            <option key={u.id} value={u.id}>{u.name}（{u.position}）</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="del-delegate" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">代理承認者<span className="text-rose-600">*</span></label>
                        <select
                          id="del-delegate"
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-slate-900 transition-all"
                          value={delDelegateId}
                          onChange={e => setDelDelegateId(e.target.value)}
                        >
                          <option value="">選択してください</option>
                          {users.filter(u => u.status === 'active' && u.id !== delDelegatorId).map(u => (
                            <option key={u.id} value={u.id}>{u.name}（{u.position}）</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label htmlFor="del-start-date" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">開始日<span className="text-rose-600">*</span></label>
                          <input id="del-start-date" type="date" className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-slate-900 transition-all" value={delStartDate} onChange={e => setDelStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="del-end-date" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">終了日（任意）</label>
                          <input id="del-end-date" type="date" className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-slate-900 transition-all" value={delEndDate} onChange={e => setDelEndDate(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="del-reason" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">理由・備考</label>
                        <input id="del-reason" type="text" placeholder="例：出張、育休など" className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-slate-900 transition-all" value={delReason} onChange={e => setDelReason(e.target.value)} />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button onClick={() => setShowAddDelegationModal(false)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all">キャンセル</button>
                        <button onClick={handleAddDelegation} disabled={!delDelegatorId || !delDelegateId || !delStartDate} className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-black transition-all disabled:opacity-30 disabled:pointer-events-none">保存する</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
                            <Link href="/inbox" onClick={() => handleNavigateToTask(log.taskId)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
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
          )}
        </main>
      </div>

      {isChangeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => setIsChangeModalOpen(false)} aria-hidden="true" />
          <div
            ref={changeModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-modal-title"
            className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300"
          >
            <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 id="change-modal-title" className="text-xl font-bold text-[#191714]">人事・組織変更の登録</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Schedule Personnel Event</p>
              </div>
              <button type="button" onClick={() => setIsChangeModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors" aria-label="閉じる">
                <ChevronRight className="w-5 h-5 rotate-90" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <label htmlFor="change-target-user" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">対象ユーザー</label>
                <select
                  id="change-target-user"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full h-12 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all"
                >
                  <option value="">ユーザーを選択してください</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="change-type-select" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">変更種別</label>
                  <select
                    id="change-type-select"
                    value={changeType}
                    onChange={(e) => setChangeType(e.target.value as typeof changeType)}
                    className="w-full h-12 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all"
                  >
                    <option value="transfer">異動 (Transfer)</option>
                    <option value="promotion">昇進 (Promotion)</option>
                    <option value="leave">休職 (Leave)</option>
                    <option value="retire">退職 (Retire)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="change-scheduled-date" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">適用予定日</label>
                  <div className="relative">
                    <input id="change-scheduled-date" type="date" className="w-full h-12 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all pl-10" />
                    <CalendarDays className="w-4 h-4 absolute left-4 top-4 text-slate-500" />
                  </div>
                </div>
              </div>

              {(changeType === 'transfer' || changeType === 'promotion') && (
                <div className="space-y-4 pt-4 border-t border-dashed">
                  <div className="space-y-2">
                    <label htmlFor="change-new-org" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">新所属組織</label>
                    <select
                      id="change-new-org"
                      value={newOrgUnit}
                      onChange={(e) => setNewOrgUnit(e.target.value)}
                      className="w-full h-12 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all"
                    >
                      <option value="">組織を選択してください</option>
                      {orgUnits.map(unit => (
                        <option key={unit.id} value={unit.id}>{unit.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="change-new-manager" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">新直属上長</label>
                    <select
                      id="change-new-manager"
                      value={newManager}
                      onChange={(e) => setNewManager(e.target.value)}
                      className="w-full h-12 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all"
                    >
                      <option value="">承認者となる上長を選択してください</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.position})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-3">
                <Shield className="w-5 h-5 text-emerald-500 shrink-0" />
                <p className="text-[11px] font-bold text-emerald-700 leading-relaxed">
                  適用時に未完了の承認タスクがある場合、自動的に新上長（または組織指定の承認者）へ引き継ぎが行われます。過去の承認履歴には変更は加わりません。
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t flex gap-3">
              <button 
                onClick={() => setIsChangeModalOpen(false)}
                className="flex-1 h-12 px-6 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-100 transition-all"
              >
                キャンセル
              </button>
              <button 
                onClick={handleApplyChange}
                disabled={!selectedUser}
                className="flex-[2] h-12 px-8 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                変更をスケジュール・適用
              </button>
            </div>
          </div>
        </div>
      )}

      {/* インポート結果モーダル */}
      {importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#191714]">インポート結果</h3>
              <button onClick={() => setImportResult(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">{importResult.count} 件を更新しました</p>
              {importResult.errors.length > 0 && (
                <div className="text-xs font-medium text-rose-600 space-y-1">
                  {importResult.errors.map((e, i) => <p key={i} className="bg-rose-50 px-3 py-1 rounded-lg border border-rose-100">{e}</p>)}
                </div>
              )}
              <button onClick={() => setImportResult(null)} className="w-full h-10 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all">閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* 新規ユーザー追加モーダル */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => setShowAddUserModal(false)} aria-hidden="true" />
          <div
            ref={addUserModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-user-modal-title"
            className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300"
          >
            <div className="p-6 border-b flex items-center justify-between">
              <h3 id="add-user-modal-title" className="text-lg font-bold text-[#191714]">メンバー新規追加</h3>
              <button type="button" onClick={() => setShowAddUserModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="閉じる"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { id: 'new-user-name', label: '氏名', value: newUserName, setter: setNewUserName, placeholder: '例: 田中 太郎' },
                { id: 'new-user-email', label: 'メールアドレス', value: newUserEmail, setter: setNewUserEmail, placeholder: 'example@company.co.jp' },
              ].map(({ id, label, value, setter, placeholder }) => (
                <div key={label} className="space-y-1">
                  <label htmlFor={id} className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">{label}</label>
                  <input id={id} type="text" value={value} onChange={e => setter(e.target.value)} placeholder={placeholder}
                    className="w-full h-10 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all" />
                </div>
              ))}
              <div className="space-y-1">
                <label htmlFor="new-user-position" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">役職</label>
                <select id="new-user-position" value={newUserPosition} onChange={e => setNewUserPosition(e.target.value)}
                  className="w-full h-10 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all">
                  {['President', 'Division Manager', 'General Manager', 'Team Leader', 'Member'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="new-user-org-unit" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">組織ユニット</label>
                <select id="new-user-org-unit" value={newUserOrgUnit} onChange={e => setNewUserOrgUnit(e.target.value)}
                  className="w-full h-10 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all">
                  <option value="">選択してください</option>
                  {orgUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddUserModal(false)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">キャンセル</button>
                <button onClick={handleAddUser} disabled={!newUserName || !newUserEmail} className="flex-[2] h-10 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all disabled:opacity-40">追加する</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* カテゴリー追加・編集モーダル — next/dynamic で遅延ロード */}
      <CategoryFormModal
        show={showAddCatModal || editingCategory !== null}
        editingCategory={editingCategory}
        catFormTab={catFormTab}
        catFormName={catFormName}
        catFormParentId={catFormParentId}
        catFormSla={catFormSla}
        catFormAmountRules={catFormAmountRules}
        catFormFields={catFormFields}
        catFormWorkflow={catFormWorkflow}
        categories={categories}
        users={users}
        onTabChange={setCatFormTab}
        onNameChange={setCatFormName}
        onParentChange={setCatFormParentId}
        onSlaChange={setCatFormSla}
        onAmountRulesChange={setCatFormAmountRules}
        onFieldsChange={setCatFormFields}
        onWorkflowChange={setCatFormWorkflow}
        onClose={() => { setShowAddCatModal(false); setEditingCategory(null); setCatFormTab('basic'); }}
        onSave={handleSaveCategory}
      />

      {/* ユーザー編集モーダル */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => { setShowEditUserModal(false); setEditingUser(null); }} aria-hidden="true" />
          <div
            ref={editUserModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-modal-title"
            className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300"
          >
            <div className="p-6 border-b flex items-center justify-between">
              <h3 id="edit-user-modal-title" className="text-lg font-bold text-[#191714]">プロフィール編集</h3>
              <button type="button" onClick={() => { setShowEditUserModal(false); setEditingUser(null); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="閉じる"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { id: 'edit-user-name', label: '氏名', value: editUserName, setter: setEditUserName, placeholder: '例: 田中 太郎' },
                { id: 'edit-user-email', label: 'メールアドレス', value: editUserEmail, setter: setEditUserEmail, placeholder: 'example@company.co.jp' },
              ].map(({ id, label, value, setter, placeholder }) => (
                <div key={label} className="space-y-1">
                  <label htmlFor={id} className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">{label}</label>
                  <input id={id} type="text" value={value} onChange={e => setter(e.target.value)} placeholder={placeholder}
                    className="w-full h-10 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all" />
                </div>
              ))}
              <div className="space-y-1">
                <label htmlFor="edit-user-position" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">役職</label>
                <select id="edit-user-position" value={editUserPosition} onChange={e => setEditUserPosition(e.target.value)}
                  className="w-full h-10 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all">
                  {['President', 'Division Manager', 'General Manager', 'Team Leader', 'Member'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="edit-user-org-unit" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">組織ユニット</label>
                <select id="edit-user-org-unit" value={editUserOrgUnit} onChange={e => setEditUserOrgUnit(e.target.value)}
                  className="w-full h-10 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all">
                  {orgUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowEditUserModal(false); setEditingUser(null); }} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">キャンセル</button>
                <button onClick={handleEditUser} disabled={!editUserName || !editUserEmail} className="flex-[2] h-10 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all disabled:opacity-40">変更を保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ユーザー無効化確認ダイアログ */}
      {deactivatingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-[#191714]">ユーザーを無効化しますか？</h3>
                <p className="text-xs text-slate-500 font-medium">「{deactivatingUser.name}」のアカウントを無効化します。この操作は人事・組織変更から元に戻すことができます。</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeactivatingUser(null)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">キャンセル</button>
                <button onClick={handleDeactivateUser} className="flex-1 h-10 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all">無効化する</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 組織ユニット追加・編集モーダル */}
      {(showAddUnitModal || editingUnit) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => { setShowAddUnitModal(false); setEditingUnit(null); }} aria-hidden="true" />
          <div
            ref={unitModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="unit-modal-title"
            className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300"
          >
            <div className="p-6 border-b flex items-center justify-between">
              <h3 id="unit-modal-title" className="text-lg font-bold text-[#191714]">{editingUnit ? 'ユニットを編集' : 'ユニットを追加'}</h3>
              <button type="button" onClick={() => { setShowAddUnitModal(false); setEditingUnit(null); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="閉じる"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label htmlFor="unit-name" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">ユニット名</label>
                <input id="unit-name" type="text" value={unitFormName} onChange={e => setUnitFormName(e.target.value)} placeholder="例: 営業第一グループ"
                  className="w-full h-10 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all" />
              </div>
              <div className="space-y-1">
                <label htmlFor="unit-type" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">種別</label>
                <select id="unit-type" value={unitFormType} onChange={e => setUnitFormType(e.target.value as OrganizationUnit['type'])}
                  className="w-full h-10 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all">
                  <option value="division">Division（事業部）</option>
                  <option value="group">Group（部）</option>
                  <option value="team">Team（チーム）</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="unit-parent" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">親ユニット</label>
                <select id="unit-parent" value={unitFormParentId} onChange={e => setUnitFormParentId(e.target.value)}
                  className="w-full h-10 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all">
                  <option value="">なし（ルートとして追加）</option>
                  {orgUnits.filter(u => u.status === 'active').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowAddUnitModal(false); setEditingUnit(null); }} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">キャンセル</button>
                <button onClick={handleSaveUnit} disabled={!unitFormName} className="flex-[2] h-10 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all disabled:opacity-40">
                  {editingUnit ? '変更を保存' : '追加する'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* カテゴリー削除確認ダイアログ */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-[#191714]">カテゴリーを削除しますか？</h3>
                <p className="text-xs text-slate-500 font-medium">「{deletingCategory.name}」を削除します。この操作は取り消せません。</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeletingCategory(null)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">キャンセル</button>
                <button onClick={handleDeleteCategory} className="flex-1 h-10 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all">削除する</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

