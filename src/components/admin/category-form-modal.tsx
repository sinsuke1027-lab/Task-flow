'use client';

import { useRef } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Category, User, AmountRule, CustomField, WorkflowStepTemplate, ApproverType } from '@/lib/repository/types';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface CategoryFormModalProps {
  show: boolean;
  editingCategory: Category | null;
  catFormTab: 'basic' | 'fields' | 'workflow';
  catFormName: string;
  catFormParentId: string;
  catFormSla: number;
  catFormAmountRules: AmountRule[];
  catFormFields: CustomField[];
  catFormWorkflow: WorkflowStepTemplate[];
  categories: Category[];
  users: User[];
  onTabChange: (tab: 'basic' | 'fields' | 'workflow') => void;
  onNameChange: (n: string) => void;
  onParentChange: (id: string) => void;
  onSlaChange: (n: number) => void;
  onAmountRulesChange: React.Dispatch<React.SetStateAction<AmountRule[]>>;
  onFieldsChange: React.Dispatch<React.SetStateAction<CustomField[]>>;
  onWorkflowChange: React.Dispatch<React.SetStateAction<WorkflowStepTemplate[]>>;
  onClose: () => void;
  onSave: () => void;
}

export function CategoryFormModal({
  show,
  editingCategory,
  catFormTab,
  catFormName,
  catFormParentId,
  catFormSla,
  catFormAmountRules,
  catFormFields,
  catFormWorkflow,
  categories,
  users,
  onTabChange,
  onNameChange,
  onParentChange,
  onSlaChange,
  onAmountRulesChange,
  onFieldsChange,
  onWorkflowChange,
  onClose,
  onSave,
}: CategoryFormModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, show, onClose);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cat-modal-title"
        className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b flex items-center justify-between shrink-0">
          <h3 id="cat-modal-title" className="text-lg font-bold text-[#191714]">{editingCategory ? 'カテゴリーを編集' : 'カテゴリーを追加'}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="閉じる">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* タブ */}
        <div className="flex border-b shrink-0">
          {([['basic', '基本設定'], ['fields', 'フォーム項目'], ['workflow', '承認フロー']] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn('flex-1 py-3 text-xs font-bold transition-colors', catFormTab === tab ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-600')}
            >
              {label}
              {tab === 'fields' && catFormFields.length > 0 && <span className="ml-1 text-blue-500">({catFormFields.length})</span>}
              {tab === 'workflow' && catFormWorkflow.length > 0 && <span className="ml-1 text-emerald-500">({catFormWorkflow.length})</span>}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* タブ1: 基本設定 */}
          {catFormTab === 'basic' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="cat-name" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">カテゴリー名</label>
                <input id="cat-name" type="text" value={catFormName} onChange={e => onNameChange(e.target.value)} placeholder="例: 資格取得祝金申請"
                  className="w-full h-10 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all" />
              </div>
              <div className="space-y-1">
                <label htmlFor="cat-parent" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">大分類（親カテゴリー）</label>
                <select id="cat-parent" value={catFormParentId} onChange={e => onParentChange(e.target.value)}
                  className="w-full h-10 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all">
                  <option value="">なし（大分類として追加）</option>
                  {categories.filter(c => c.parentId === null).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="cat-sla" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">目標SLA（営業日）</label>
                <input id="cat-sla" type="number" min={1} max={90} value={catFormSla} onChange={e => onSlaChange(Number(e.target.value))}
                  className="w-full h-10 px-4 bg-slate-50 border rounded-xl font-bold text-sm focus:outline-none focus:border-slate-400 transition-all" />
              </div>
              <div className="space-y-2 pt-2 border-t border-dashed border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">金額閾値ルール（任意）</label>
                  <button type="button" onClick={() => onAmountRulesChange(prev => [...prev, { fieldLabel: '', minAmount: 0, requiredPosition: 'Division Manager' }])}
                    className="text-[10px] font-black text-blue-600 hover:text-blue-800 transition-colors">+ ルールを追加</button>
                </div>
                {catFormAmountRules.map((rule, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
                    <input type="text" placeholder="フィールド名（例: 金額）" value={rule.fieldLabel}
                      onChange={e => onAmountRulesChange(prev => prev.map((r, i) => i === idx ? { ...r, fieldLabel: e.target.value } : r))}
                      className="h-9 px-3 bg-slate-50 border rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 transition-all" />
                    <div className="flex gap-1.5 items-center">
                      <span className="text-xs text-slate-500 font-bold shrink-0">¥</span>
                      <input type="number" placeholder="閾値（例: 100000）" value={rule.minAmount || ''}
                        onChange={e => onAmountRulesChange(prev => prev.map((r, i) => i === idx ? { ...r, minAmount: Number(e.target.value) } : r))}
                        className="flex-1 h-9 px-3 bg-slate-50 border rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 transition-all" />
                    </div>
                    <button type="button" onClick={() => onAmountRulesChange(prev => prev.filter((_, i) => i !== idx))}
                      className="h-9 w-9 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="col-span-2">
                      <select value={rule.requiredPosition}
                        onChange={e => onAmountRulesChange(prev => prev.map((r, i) => i === idx ? { ...r, requiredPosition: e.target.value } : r))}
                        className="w-full h-9 px-3 bg-slate-50 border rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 transition-all">
                        {['Team Leader', 'General Manager', 'Division Manager', 'President'].map(p => (
                          <option key={p} value={p}>{p} の承認が必要</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                {catFormAmountRules.length === 0 && <p className="text-[10px] text-slate-500 font-medium px-1">ルールなし（すべての金額で同一フローを適用）</p>}
              </div>
            </div>
          )}

          {/* タブ2: フォーム項目 */}
          {catFormTab === 'fields' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">申請フォームに表示されるカスタム項目を設定します。</p>
                <button type="button"
                  onClick={() => onFieldsChange(prev => [...prev, { id: `f_${Date.now()}`, label: '', type: 'text', required: false }])}
                  className="text-[10px] font-black text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap">+ 項目を追加</button>
              </div>
              {catFormFields.length === 0 && (
                <div className="py-8 text-center text-slate-500 text-xs">項目がありません。「+ 項目を追加」から追加してください。</div>
              )}
              {catFormFields.map((field, idx) => (
                <div key={field.id} className="p-3 bg-slate-50 border rounded-2xl space-y-2">
                  <div className="flex gap-2 items-center">
                    <input type="text" aria-label="項目名" placeholder="項目名（例: 受験料）" value={field.label}
                      onChange={e => onFieldsChange(prev => prev.map((f, i) => i === idx ? { ...f, label: e.target.value } : f))}
                      className="flex-1 h-8 px-3 bg-white border rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 transition-all" />
                    <select aria-label="項目タイプ" value={field.type}
                      onChange={e => onFieldsChange(prev => prev.map((f, i) => i === idx ? { ...f, type: e.target.value as CustomField['type'], options: undefined } : f))}
                      className="h-8 px-2 bg-white border rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 transition-all">
                      <option value="text">テキスト</option>
                      <option value="textarea">長文テキスト</option>
                      <option value="number">数値</option>
                      <option value="date">日付</option>
                      <option value="select">選択肢</option>
                      <option value="checkbox">チェックボックス</option>
                      <option value="file">ファイル添付</option>
                    </select>
                    <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 whitespace-nowrap">
                      <input type="checkbox" checked={field.required}
                        onChange={e => onFieldsChange(prev => prev.map((f, i) => i === idx ? { ...f, required: e.target.checked } : f))} />
                      必須
                    </label>
                    <button type="button" onClick={() => onFieldsChange(prev => prev.filter((_, i) => i !== idx))}
                      className="h-8 w-8 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input type="text" aria-label="プレースホルダー" placeholder="プレースホルダー（任意）" value={field.placeholder ?? ''}
                    onChange={e => onFieldsChange(prev => prev.map((f, i) => i === idx ? { ...f, placeholder: e.target.value } : f))}
                    className="w-full h-7 px-3 bg-white border rounded-xl text-[11px] text-slate-500 focus:outline-none focus:border-slate-400 transition-all" />
                  {field.type === 'select' && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-500 font-bold">選択肢（改行区切り）</p>
                      <textarea rows={3} aria-label="選択肢（改行区切り）" value={(field.options ?? []).join('\n')}
                        onChange={e => onFieldsChange(prev => prev.map((f, i) => i === idx ? { ...f, options: e.target.value.split('\n').filter(Boolean) } : f))}
                        className="w-full px-3 py-2 bg-white border rounded-xl text-xs focus:outline-none focus:border-slate-400 transition-all resize-none" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* タブ3: 承認フロー */}
          {catFormTab === 'workflow' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">承認ルートのテンプレートを設定します。申請時に自動適用されます。</p>
                <button type="button"
                  onClick={() => onWorkflowChange(prev => [...prev, { id: `wf_${Date.now()}`, label: '', approverType: 'direct_manager', stageIndex: prev.length }])}
                  className="text-[10px] font-black text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap">+ ステップを追加</button>
              </div>
              {catFormWorkflow.length === 0 && (
                <div className="py-8 text-center text-slate-500 text-xs">ステップがありません。「+ ステップを追加」から追加してください。<br/>テンプレートなしの場合は申請者が手動で承認者を選択します。</div>
              )}
              {catFormWorkflow.map((step, idx) => (
                <div key={step.id} className="p-3 bg-slate-50 border rounded-2xl space-y-2">
                  <div className="flex gap-2 items-center">
                    <span className="text-[10px] font-black text-slate-500 w-5 shrink-0">{idx + 1}</span>
                    <input type="text" aria-label="ステップ名" placeholder="ステップ名（例: 上長承認）" value={step.label}
                      onChange={e => onWorkflowChange(prev => prev.map((s, i) => i === idx ? { ...s, label: e.target.value } : s))}
                      className="flex-1 h-8 px-3 bg-white border rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 transition-all" />
                    <button type="button" onClick={() => onWorkflowChange(prev => prev.filter((_, i) => i !== idx))}
                      className="h-8 w-8 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <select aria-label="承認者タイプ" value={step.approverType}
                      onChange={e => onWorkflowChange(prev => prev.map((s, i) => i === idx ? { ...s, approverType: e.target.value as ApproverType, approverUserId: undefined, approverRole: undefined, approverGroupIds: undefined } : s))}
                      className="flex-1 h-8 px-2 bg-white border rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 transition-all">
                      <option value="direct_manager">直属上長</option>
                      <option value="second_manager">2段階上長</option>
                      <option value="third_manager">3段階上長</option>
                      <option value="specific_user">特定ユーザー</option>
                      <option value="role">役職グループ</option>
                      <option value="approval_group">承認グループ</option>
                    </select>
                    {step.approverType === 'role' && (
                      <select aria-label="役職" value={step.approverRole ?? ''}
                        onChange={e => onWorkflowChange(prev => prev.map((s, i) => i === idx ? { ...s, approverRole: e.target.value } : s))}
                        className="flex-1 h-8 px-2 bg-white border rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 transition-all">
                        <option value="">役職を選択</option>
                        <option value="HR_Admin">人事担当（HR_Admin）</option>
                        <option value="IT_Admin">IT担当（IT_Admin）</option>
                        <option value="GA_Admin">総務担当（GA_Admin）</option>
                      </select>
                    )}
                    {step.approverType === 'specific_user' && (
                      <select aria-label="特定ユーザー" value={step.approverUserId ?? ''}
                        onChange={e => onWorkflowChange(prev => prev.map((s, i) => i === idx ? { ...s, approverUserId: e.target.value } : s))}
                        className="flex-1 h-8 px-2 bg-white border rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 transition-all">
                        <option value="">ユーザーを選択</option>
                        {users.filter(u => u.status === 'active').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    )}
                    {step.approverType === 'approval_group' && (
                      <select aria-label="並列設定" value={step.parallelType ?? 'or'}
                        onChange={e => onWorkflowChange(prev => prev.map((s, i) => i === idx ? { ...s, parallelType: e.target.value as 'or' | 'and' } : s))}
                        className="h-8 px-2 bg-white border rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 transition-all">
                        <option value="or">OR（誰か1名）</option>
                        <option value="and">AND（全員）</option>
                      </select>
                    )}
                  </div>
                  {step.approverType === 'approval_group' && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-500 font-bold">グループメンバー</p>
                      <div className="flex flex-wrap gap-1">
                        {users.filter(u => u.status === 'active').map(u => {
                          const selected = (step.approverGroupIds ?? []).includes(u.id);
                          return (
                            <button key={u.id} type="button"
                              onClick={() => onWorkflowChange(prev => prev.map((s, i) => {
                                if (i !== idx) return s;
                                const ids = s.approverGroupIds ?? [];
                                return { ...s, approverGroupIds: selected ? ids.filter(id => id !== u.id) : [...ids, u.id] };
                              }))}
                              className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold transition-all border', selected ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400')}>
                              {u.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">キャンセル</button>
          <button onClick={onSave} disabled={!catFormName} className="flex-[2] h-10 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all disabled:opacity-40">
            {editingCategory ? '変更を保存' : '追加する'}
          </button>
        </div>
      </div>
    </div>
  );
}
