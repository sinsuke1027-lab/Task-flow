'use client';

import { useState, useEffect } from 'react';
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
  FileText
} from 'lucide-react';
import { getDataProvider } from '@/lib/repository/factory';
import { Category, OrganizationUnit, User, AuditLog } from '@/lib/repository/types';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ClientOnlyDate } from '@/components/common/client-only-date';

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<'general' | 'org' | 'categories' | 'security' | 'logs'>('general');
  const [orgUnits, setOrgUnits] = useState<OrganizationUnit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  
  // Logs Search & Filter
  const [logSearchQuery, setLogSearchQuery] = useState('');
  
  // Modal State
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [changeType, setChangeType] = useState<'transfer' | 'retire' | 'leave' | 'promotion'>('transfer');
  const [newManager, setNewManager] = useState<string>('');
  const [newOrgUnit, setNewOrgUnit] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      const provider = getDataProvider();
      const [units, cats, allUsers, allLogs] = await Promise.all([
        provider.getOrganizationUnits(),
        provider.getCategories(),
        provider.getUsers(),
        provider.getAllAuditLogs()
      ]);
      setOrgUnits(units);
      setCategories(cats);
      setUsers(allUsers.slice(0, 50));
      setLogs(allLogs);
    };
    fetchData();
  }, []);

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
    window.location.reload();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#191714]">管理者設定</h1>
        <p className="text-slate-500 font-medium font-bold text-sm">システム全体の構成、組織マスタ、申請カテゴリーの管理を行います。</p>
      </header>

      <div className="flex gap-8">
        <aside className="w-64 space-y-1">
          {[
            { id: 'general', label: '基本設定', icon: Settings },
            { id: 'org', label: '組織・メンバー', icon: Users },
            { id: 'categories', label: '申請カテゴリー', icon: ListTree },
            { id: 'security', label: 'セキュリティ・権限', icon: Shield },
            { id: 'logs', label: '監査ログ', icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                activeTab === tab.id 
                  ? "bg-slate-900 text-white shadow-xl translate-x-1" 
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && <ChevronRight className="w-3 h-3 ml-auto animate-in fade-in slide-in-from-left-1" />}
            </button>
          ))}
        </aside>

        <main className="flex-1 space-y-8 pb-20">
          {activeTab === 'general' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <section className="bg-white rounded-3xl border border-slate-200 notion-shadow p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#191714]">システム基本情報</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">General System Settings</p>
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all">
                    <Save className="w-4 h-4" />
                    設定を保存
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-8 pt-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">テナント名</label>
                    <input type="text" defaultValue="株式会社デジタルフォルン (Task Flow)" className="w-full h-10 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">データソース</label>
                    <div className="w-full h-10 px-4 bg-slate-100 border rounded-xl flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-500">SharePoint Lists (Mocked)</span>
                      <Shield className="w-4 h-4 text-emerald-500" />
                    </div>
                  </div>
                </div>
              </section>

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
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total {users.length} Members Sampled</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsChangeModalOpen(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                      人事・組織変更
                    </button>
                    <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all text-slate-600">
                      <Upload className="w-4 h-4" />
                      一括インポート
                    </button>
                    <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all text-slate-600">
                      <Plus className="w-4 h-4" />
                      新規追加
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 border-b">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">氏名 / メールアドレス</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">役職</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">所属ユニット</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ステータス</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                {u.name.charAt(0)}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-[#191714]">{u.name}</div>
                                <div className="text-[10px] font-medium text-slate-400">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-black uppercase tracking-tight bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">{u.position}</span>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-400">
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
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 text-[10px] font-bold border border-slate-200">
                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                無効
                              </span>
                            )}
                            {u.status === 'on_leave' && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold border border-amber-100">
                                <div className="w-1 h-1 rounded-full bg-amber-500" />
                                休職中
                              </span>
                            )}
                          </td>
                          <td className="pr-4">
                            <button className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="w-4 h-4 text-slate-400" />
                            </button>
                          </td>
                        </tr>
                      ))}
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
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure SLA and Approval Templates</p>
                  </div>
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all">
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
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{parent?.name || '基本カテゴリ'}</div>
                          <div className="text-sm font-bold text-[#191714]">{cat.name}</div>
                          <div className="mt-2 flex items-center gap-2">
                            <Clock className="w-3 h-3 text-emerald-500" />
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">目標SLA: {cat.slaDays}日</span>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button className="p-2 hover:bg-white rounded-lg text-slate-400 border border-transparent hover:border-slate-200 transition-all"><Settings className="w-3.5 h-3.5" /></button>
                          <button className="p-2 hover:bg-rose-50 rounded-lg text-rose-300 hover:text-rose-600 border border-transparent hover:border-rose-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
               <section className="bg-white rounded-3xl border border-slate-200 notion-shadow p-8 flex flex-col items-center justify-center text-center py-20">
                 <Shield className="w-12 h-12 text-slate-200 mb-4" />
                 <h2 className="text-xl font-bold text-[#191714]">セキュリティ・権限設定</h2>
                 <p className="text-sm text-slate-400 max-w-sm">システム権限ロールやIP制限の設定は、現在準備中です。プロトタイプ版ではデフォルトのRoleBasedPolicyが適用されています。</p>
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
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">System-wide Activity History</p>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      placeholder="ユーザー名、アクション種別で検索..."
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-slate-400 transition-all"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 border-b">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">日時</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">実行者</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">アクション</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">詳細</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs
                        .filter(log => 
                          logSearchQuery === '' || 
                          log.userName?.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                          log.action.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                          log.comment?.toLowerCase().includes(logSearchQuery.toLowerCase())
                        )
                        .map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <span className="text-xs font-medium text-slate-500">
                              <ClientOnlyDate date={log.timestamp} showTime={true} />
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-[#191714]">{log.userName}</span>
                            {log.comment && <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{log.comment}</p>}
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
                            <Link href="/inbox" onClick={() => localStorage.setItem('task_bridge_force_inbox_task', log.taskId)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
                              <FileText className="w-3.5 h-3.5" />
                              該当タスクへ
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {logs.filter(log => logSearchQuery === '' || log.userName?.toLowerCase().includes(logSearchQuery.toLowerCase()) || log.action.toLowerCase().includes(logSearchQuery.toLowerCase()) || log.comment?.toLowerCase().includes(logSearchQuery.toLowerCase())).length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm font-medium">
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
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-[#191714]">人事・組織変更の登録</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Schedule Personnel Event</p>
              </div>
              <button onClick={() => setIsChangeModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                <ChevronRight className="w-5 h-5 rotate-90" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">対象ユーザー</label>
                <select 
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">変更種別</label>
                  <select 
                    value={changeType} 
                    onChange={(e) => setChangeType(e.target.value as any)}
                    className="w-full h-12 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all"
                  >
                    <option value="transfer">異動 (Transfer)</option>
                    <option value="promotion">昇進 (Promotion)</option>
                    <option value="leave">休職 (Leave)</option>
                    <option value="retire">退職 (Retire)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">適用予定日</label>
                  <div className="relative">
                    <input type="date" className="w-full h-12 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all pl-10" />
                    <CalendarDays className="w-4 h-4 absolute left-4 top-4 text-slate-400" />
                  </div>
                </div>
              </div>

              {(changeType === 'transfer' || changeType === 'promotion') && (
                <div className="space-y-4 pt-4 border-t border-dashed">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">新所属組織</label>
                    <select 
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">新直属上長</label>
                    <select 
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
    </div>
  );
}

