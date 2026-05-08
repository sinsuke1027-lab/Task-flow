'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Plus, Settings, Trash2, Clock } from 'lucide-react';
import { Category, User, AmountRule, CustomField, WorkflowStepTemplate } from '@/lib/repository/types';
import { getDataProvider } from '@/lib/repository/factory';

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

interface AdminCategoriesSectionProps {
  categories: Category[];
  users: User[];
  onRefetch: () => Promise<void>;
}

export function AdminCategoriesSection({ categories, users, onRefetch }: AdminCategoriesSectionProps) {
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
    await onRefetch();
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    const provider = getDataProvider();
    await provider.deleteCategory(deletingCategory.id);
    setDeletingCategory(null);
    await onRefetch();
  };

  return (
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
