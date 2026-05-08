'use client';

import { useRef } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface RejectModalProps {
  show: boolean;
  isProcessing: boolean;
  rejectComment: string;
  onChange: (text: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function RejectModal({ show, isProcessing, rejectComment, onChange, onClose, onConfirm }: RejectModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, show, onClose);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-modal-title"
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
      >
        <div className="p-6 border-b flex items-center justify-between">
          <h3 id="reject-modal-title" className="text-lg font-bold text-[#191714]">差し戻し理由を入力</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="閉じる">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-500 font-medium">申請者に差し戻す理由を入力してください。コメントは必須です。</p>
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">定型テンプレート</p>
            <div className="flex flex-wrap gap-2">
              {[
                '内容を修正して再申請してください',
                '添付書類が不足しています',
                '上長の承認を先に取得してください',
                '予算超過のため再検討が必要です',
              ].map(tmpl => (
                <button
                  key={tmpl}
                  onClick={() => onChange(tmpl)}
                  className="px-3 py-1.5 text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 hover:border-slate-400 transition-all text-slate-600"
                >
                  {tmpl}
                </button>
              ))}
            </div>
          </div>
          <textarea
            rows={4}
            aria-label="差し戻し理由"
            placeholder="差し戻し理由を入力してください（必須）..."
            value={rejectComment}
            onChange={(e) => onChange(e.target.value)}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all resize-none"
          />
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all">
              キャンセル
            </button>
            <button
              onClick={onConfirm}
              disabled={!rejectComment.trim() || isProcessing}
              className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-bold text-sm hover:bg-rose-700 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              {isProcessing ? '処理中...' : '差し戻しを確定'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
