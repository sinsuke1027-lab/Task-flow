'use client';

import { useState, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { Delegation, User } from '@/lib/repository/types';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { cn } from '@/lib/utils';

interface AdminDelegationSectionProps {
  delegations: Delegation[];
  users: User[];
  onRevoke: (id: string) => Promise<void>;
  onAdd: (params: {
    delegatorId: string;
    delegateId: string;
    startDate: string;
    endDate?: string;
    reason?: string;
  }) => Promise<void>;
}

export function AdminDelegationSection({ delegations, users, onRevoke, onAdd }: AdminDelegationSectionProps) {
  const [showAddDelegationModal, setShowAddDelegationModal] = useState(false);
  const [delDelegatorId, setDelDelegatorId] = useState('');
  const [delDelegateId, setDelDelegateId] = useState('');
  const [delStartDate, setDelStartDate] = useState('');
  const [delEndDate, setDelEndDate] = useState('');
  const [delReason, setDelReason] = useState('');

  const delegationModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(delegationModalRef, showAddDelegationModal, () => setShowAddDelegationModal(false));

  const handleAdd = async () => {
    if (!delDelegatorId || !delDelegateId || !delStartDate) return;
    await onAdd({
      delegatorId: delDelegatorId,
      delegateId: delDelegateId,
      startDate: delStartDate,
      endDate: delEndDate || undefined,
      reason: delReason || undefined,
    });
    setShowAddDelegationModal(false);
    setDelDelegatorId(''); setDelDelegateId(''); setDelStartDate(''); setDelEndDate(''); setDelReason('');
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('この代決設定を無効化しますか？')) return;
    await onRevoke(id);
  };

  return (
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
                    onClick={() => handleRevoke(d.id)}
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
                <button onClick={handleAdd} disabled={!delDelegatorId || !delDelegateId || !delStartDate} className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-black transition-all disabled:opacity-30 disabled:pointer-events-none">保存する</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
