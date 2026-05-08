'use client';

import { useState, useRef } from 'react';
import {
  Plus, MoreHorizontal, RefreshCw, Upload, Settings, Trash2,
  X, ChevronRight, CheckCircle2, Shield, CalendarDays
} from 'lucide-react';
import { OrganizationUnit, User } from '@/lib/repository/types';
import { getDataProvider } from '@/lib/repository/factory';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface AdminOrgSectionProps {
  users: User[];
  orgUnits: OrganizationUnit[];
  onRefetch: () => Promise<void>;
}

export function AdminOrgSection({ users, orgUnits, onRefetch }: AdminOrgSectionProps) {
  // Personnel change modal
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [changeType, setChangeType] = useState<'transfer' | 'retire' | 'leave' | 'promotion'>('transfer');
  const [newManager, setNewManager] = useState('');
  const [newOrgUnit, setNewOrgUnit] = useState('');

  // Import
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<{ count: number; errors: string[] } | null>(null);

  // Add user
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPosition, setNewUserPosition] = useState('Member');
  const [newUserOrgUnit, setNewUserOrgUnit] = useState('');

  // User row menu
  const [userMenuTargetId, setUserMenuTargetId] = useState<string | null>(null);

  // Edit user
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPosition, setEditUserPosition] = useState('');
  const [editUserOrgUnit, setEditUserOrgUnit] = useState('');

  // Deactivate
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);

  // Org unit modal
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<OrganizationUnit | null>(null);
  const [unitFormName, setUnitFormName] = useState('');
  const [unitFormType, setUnitFormType] = useState<OrganizationUnit['type']>('team');
  const [unitFormParentId, setUnitFormParentId] = useState('');

  // Focus traps
  const changeModalRef = useRef<HTMLDivElement>(null);
  const addUserModalRef = useRef<HTMLDivElement>(null);
  const editUserModalRef = useRef<HTMLDivElement>(null);
  const unitModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(changeModalRef, isChangeModalOpen, () => setIsChangeModalOpen(false));
  useFocusTrap(addUserModalRef, showAddUserModal, () => setShowAddUserModal(false));
  useFocusTrap(editUserModalRef, showEditUserModal, () => { setShowEditUserModal(false); setEditingUser(null); });
  useFocusTrap(unitModalRef, showAddUnitModal || editingUnit !== null, () => { setShowAddUnitModal(false); setEditingUnit(null); });

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
      changes,
      note: 'Admin manual update'
    });
    await provider.applyUserChange(event.id);
    setIsChangeModalOpen(false);
    await onRefetch();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const provider = getDataProvider();
    const result = await provider.importBulkData('users', text);
    setImportResult(result);
    await onRefetch();
    e.target.value = '';
  };

  const handleAddUser = async () => {
    if (!newUserName || !newUserEmail) return;
    const provider = getDataProvider();
    await provider.createUser({
      name: newUserName, email: newUserEmail, role: 'user',
      position: newUserPosition,
      orgUnitId: newUserOrgUnit || (orgUnits[0]?.id ?? ''),
      departmentId: '', managerId: null, status: 'active',
      joinedAt: new Date().toISOString(),
    });
    setShowAddUserModal(false);
    setNewUserName(''); setNewUserEmail(''); setNewUserPosition('Member'); setNewUserOrgUnit('');
    await onRefetch();
  };

  const handleEditUser = async () => {
    if (!editingUser || !editUserName || !editUserEmail) return;
    const provider = getDataProvider();
    await provider.updateUser(editingUser.id, {
      name: editUserName, email: editUserEmail,
      position: editUserPosition,
      orgUnitId: editUserOrgUnit || editingUser.orgUnitId,
    });
    setShowEditUserModal(false);
    setEditingUser(null);
    await onRefetch();
  };

  const handleDeactivateUser = async () => {
    if (!deactivatingUser) return;
    const provider = getDataProvider();
    await provider.updateUser(deactivatingUser.id, { status: 'inactive', leftAt: new Date().toISOString() });
    setDeactivatingUser(null);
    await onRefetch();
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
    await onRefetch();
  };

  const handleArchiveUnit = async (unitId: string) => {
    const provider = getDataProvider();
    await provider.archiveOrganizationUnit(unitId);
    await onRefetch();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* ユーザーテーブル */}
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
                  <td className="px-6 py-4 text-xs font-bold text-slate-500">{u.orgUnitId.split('_').pop()}</td>
                  <td className="px-6 py-4">
                    {u.status === 'active' && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                        <div className="w-1 h-1 rounded-full bg-emerald-500" />有効
                      </span>
                    )}
                    {u.status === 'inactive' && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-bold border border-slate-200">
                        <div className="w-1 h-1 rounded-full bg-slate-300" />無効
                      </span>
                    )}
                    {u.status === 'on_leave' && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-100">
                        <div className="w-1 h-1 rounded-full bg-amber-500" />休職中
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
                            <Settings className="w-3.5 h-3.5 text-slate-500" />プロフィール編集
                          </button>
                          <button
                            onClick={() => { setSelectedUser(u.id); setIsChangeModalOpen(true); setUserMenuTargetId(null); }}
                            className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />人事・組織変更
                          </button>
                          {u.status === 'active' && (
                            <button
                              onClick={() => { setDeactivatingUser(u); setUserMenuTargetId(null); }}
                              className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2 border-t border-slate-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />無効化
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

      {/* 人事・組織変更モーダル */}
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
                <select id="change-target-user" value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full h-12 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all">
                  <option value="">ユーザーを選択してください</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="change-type-select" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">変更種別</label>
                  <select id="change-type-select" value={changeType} onChange={(e) => setChangeType(e.target.value as typeof changeType)}
                    className="w-full h-12 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all">
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
                    <select id="change-new-org" value={newOrgUnit} onChange={(e) => setNewOrgUnit(e.target.value)}
                      className="w-full h-12 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all">
                      <option value="">組織を選択してください</option>
                      {orgUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="change-new-manager" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">新直属上長</label>
                    <select id="change-new-manager" value={newManager} onChange={(e) => setNewManager(e.target.value)}
                      className="w-full h-12 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all">
                      <option value="">承認者となる上長を選択してください</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.position})</option>)}
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
              <button onClick={() => setIsChangeModalOpen(false)} className="flex-1 h-12 px-6 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-100 transition-all">キャンセル</button>
              <button onClick={handleApplyChange} disabled={!selectedUser}
                className="flex-[2] h-12 px-8 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />変更をスケジュール・適用
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
          <div ref={addUserModalRef} role="dialog" aria-modal="true" aria-labelledby="add-user-modal-title"
            className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
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

      {/* ユーザー編集モーダル */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => { setShowEditUserModal(false); setEditingUser(null); }} aria-hidden="true" />
          <div ref={editUserModalRef} role="dialog" aria-modal="true" aria-labelledby="edit-user-modal-title"
            className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
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

      {/* ユーザー無効化確認 */}
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
          <div ref={unitModalRef} role="dialog" aria-modal="true" aria-labelledby="unit-modal-title"
            className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
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
    </div>
  );
}
