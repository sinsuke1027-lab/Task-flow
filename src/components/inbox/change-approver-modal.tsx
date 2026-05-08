'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { Search, X } from 'lucide-react';
import { Task, User } from '@/lib/repository/types';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface ChangeApproverModalProps {
  show: boolean;
  changingStepIndex: number | null;
  selectedTask: Task | null;
  allUsers: User[];
  approverSearchQuery: string;
  onSearchChange: (q: string) => void;
  onClose: () => void;
  onConfirm: (userId: string) => void;
}

export function ChangeApproverModal({
  show,
  changingStepIndex,
  selectedTask,
  allUsers,
  approverSearchQuery,
  onSearchChange,
  onClose,
  onConfirm,
}: ChangeApproverModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, show, onClose);

  if (!show || changingStepIndex === null) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-approver-modal-title"
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
      >
        <div className="p-6 border-b flex items-center justify-between">
          <h3 id="change-approver-modal-title" className="text-lg font-bold text-[#191714]">承認者を変更</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="閉じる">
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
              onChange={(e) => onSearchChange(e.target.value)}
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
                  onClick={() => onConfirm(u.id)}
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
  );
}
