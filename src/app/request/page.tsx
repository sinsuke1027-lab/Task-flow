'use client';

import { useState, useEffect, Suspense } from 'react';
import { 
  Send, 
  UserPlus, 
  X, 
  Plus, 
  Search,
  ChevronDown,
  Info,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar
} from 'lucide-react';
import { getDataProvider } from '@/lib/repository/factory';
import { Category, User, ApprovalStep } from '@/lib/repository/types';
import { useAuth } from '@/context/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';

function RequestFormContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reuseTaskId = searchParams.get('reuseTaskId');
  const [categories, setCategories] = useState<Category[]>([]);
  const [largeCategory, setLargeCategory] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customData, setCustomData] = useState<Record<string, string | number>>({});
  const [approvalRoute, setApprovalRoute] = useState<ApprovalStep[]>([]);
  const [ccRoute, setCcRoute] = useState<ApprovalStep[]>([]);
  
  // For User Search (Generic for Approver and CC)
  const [showSearch, setShowSearch] = useState(false);
  const [searchMode, setSearchMode] = useState<'approver' | 'cc'>('approver');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      const provider = getDataProvider();
      const cats = await provider.getCategories();
      setCategories(cats);
    };
    fetchCategories();
  }, []);

  // Pre-populate data if reuseTaskId is provided
  useEffect(() => {
    if (categories.length > 0 && reuseTaskId) {
      const fetchOldTask = async () => {
        const provider = getDataProvider();
        const oldTask = await provider.getTaskById(reuseTaskId);
        if (oldTask) {
          setTitle(oldTask.title); // Requirement: No prefix for title
          setDescription(oldTask.description);
          setCustomData(oldTask.customData || {});
          setCcRoute(oldTask.ccRoute || []);
          
          const cat = categories.find(c => c.id === oldTask.categoryId);
          if (cat) {
            setSelectedCategory(cat);
            if (cat.parentId) {
              setLargeCategory(cat.parentId);
            }
          }
        }
      };
      fetchOldTask();
    }
  }, [categories, reuseTaskId]);

  // Default hierarchy for approval
  useEffect(() => {
    const generateRoute = async () => {
      if (user) {
        const provider = getDataProvider();
        const hierarchy = await provider.getManagerHierarchy(user.id);
        const steps: ApprovalStep[] = hierarchy.map(u => ({
          userId: u.id,
          userName: u.name,
          position: u.position,
          avatar: u.avatar,
          status: 'pending'
        }));
        setApprovalRoute(steps);
      }
    };
    generateRoute();
  }, [user]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length > 1) {
      const provider = getDataProvider();
      const users = await provider.getUsers();
      const results = users.filter(u => 
        u.name.includes(query) || u.position?.includes(query)
      ).slice(0, 5);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const addUser = (u: User) => {
    const newStep: ApprovalStep = {
      userId: u.id,
      userName: u.name,
      position: u.position,
      avatar: u.avatar,
      status: 'pending'
    };
    
    if (searchMode === 'approver') {
      setApprovalRoute([...approvalRoute, newStep]);
    } else {
      // Avoid duplicate CC
      if (!ccRoute.some(s => s.userId === u.id)) {
        setCcRoute([...ccRoute, newStep]);
      }
    }
    
    setShowSearch(false);
    setSearchQuery('');
  };

  const removeApprover = (index: number) => {
    const next = [...approvalRoute];
    next.splice(index, 1);
    setApprovalRoute(next);
  };

  const removeCcUser = (index: number) => {
    const next = [...ccRoute];
    next.splice(index, 1);
    setCcRoute(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !title) return;

    const provider = getDataProvider();
    await provider.createTask({
      title,
      description: description || '',
      requesterId: user?.id || '',
      categoryId: selectedCategory.id,
      targetDepartmentId: selectedCategory.targetDepartmentId,
      priority: 'normal',
      approvalRoute,
      ccRoute,
      customData
    });

    router.push('/tracker');
  };

  const largeCategoryOptions = categories.filter(c => c.parentId === null);
  const mediumCategoryOptions = categories.filter(c => c.parentId === largeCategory);

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      <header className="flex flex-col gap-1 border-b pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#191714]">新規申請・相談</h1>
        <p className="text-slate-500 font-medium font-bold">依頼内容を入力し、承認ルートを確認して送信してください。</p>
      </header>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-10">
          {/* Section 1: Categories */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-slate-900 border">1</span>
              カテゴリー選択
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">大分類</label>
                <div className="relative group">
                  <select 
                    className="w-full h-12 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-bold text-slate-900"
                    onChange={(e) => {
                      setLargeCategory(e.target.value);
                      setSelectedCategory(null);
                    }}
                    value={largeCategory}
                  >
                    <option value="">選択してください</option>
                    {largeCategoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">中分類</label>
                <div className="relative group">
                  <select 
                    className="w-full h-12 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-bold text-slate-900 disabled:opacity-50"
                    disabled={!largeCategory}
                    onChange={(e) => {
                      const cat = categories.find(c => c.id === e.target.value);
                      setSelectedCategory(cat || null);
                      setCustomData({}); 
                    }}
                    value={selectedCategory?.id || ''}
                  >
                    <option value="">選択してください</option>
                    {mediumCategoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" />
                </div>
              </div>
            </div>
            
            {selectedCategory && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex gap-4 animate-in zoom-in-95 duration-300">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-blue-900">標準処理期間（SLA）目安: {selectedCategory.slaDays}営業日</h4>
                  <p className="text-xs font-medium text-blue-700 mt-0.5">
                    この申請は通常、受理から{selectedCategory.slaDays}営業日で完了します。
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Section 2: Details */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-slate-900 border">2</span>
              申請内容の詳細
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">タイトル</label>
                <input 
                  type="text" 
                  placeholder="例：2026年度 資格取得祝金申請"
                  className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-bold text-slate-900"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">詳細説明 / 追記</label>
                <textarea 
                  rows={6}
                  placeholder="申請の背景、希望する対応内容などを記載してください。"
                  className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium text-slate-900 resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Dynamic Fields Section */}
              {selectedCategory?.customFields && selectedCategory.customFields.length > 0 && (
                <div className="pt-6 mt-6 border-t border-slate-100 space-y-4 animate-in fade-in duration-500">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                    <h3 className="text-sm font-bold text-[#191714]">追加入力項目</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedCategory.customFields.map((field) => (
                      <div key={field.id} className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                          {field.label}
                          {field.required && <span className="text-rose-500 ml-1">*</span>}
                        </label>
                        
                        {field.type === 'select' ? (
                          <div className="relative">
                            <select 
                              className="w-full h-12 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-bold text-slate-900"
                              value={customData[field.label] || ''}
                              onChange={(e) => setCustomData({...customData, [field.label]: e.target.value})}
                              required={field.required}
                            >
                              <option value="">選択してください</option>
                              {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
                          </div>
                        ) : field.type === 'date' ? (
                          <input 
                            type="date"
                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-bold text-slate-900"
                            value={customData[field.label] || ''}
                            onChange={(e) => setCustomData({...customData, [field.label]: e.target.value})}
                            required={field.required}
                          />
                        ) : (
                          <input 
                            type={field.type === 'number' ? 'number' : 'text'}
                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-bold text-slate-900"
                            placeholder={`${field.label}を入力...`}
                            value={customData[field.label] || ''}
                            onChange={(e) => setCustomData({...customData, [field.label]: e.target.value})}
                            required={field.required}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2 p-4 mt-4 bg-slate-50 border border-dashed rounded-xl text-slate-400 cursor-pointer hover:bg-slate-100 hover:text-slate-600 transition-all">
                <Plus className="w-4 h-4 ml-auto" />
                <span className="text-xs font-bold mr-auto">ファイルを添付またはドラッグ＆ドロップ</span>
              </div>
            </div>
          </section>
        </div>

        {/* Section 3: Approval Route */}
        <aside className="space-y-6">
          <div className="sticky top-24 space-y-8">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-slate-900 border">3</span>
                承認フロー
              </div>
              <button 
                type="button"
                onClick={() => {
                  setSearchMode('approver');
                  setShowSearch(true);
                }}
                className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 hover:bg-blue-100 transition-all"
              >
                <UserPlus className="w-3 h-3" />
                承認者を追加
              </button>
            </div>
            
            {/* Cc Users compact section */}
            <div className="space-y-4 px-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CC（共有先）</div>
                <button 
                  type="button"
                  onClick={() => {
                    setSearchMode('cc');
                    setShowSearch(true);
                  }}
                  className="text-[9px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-2.5 h-2.5" /> 追加
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {ccRoute.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 pl-1 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-full animate-in zoom-in-95 duration-200 group/cc">
                    <img src={step.avatar} className="w-4 h-4 rounded-full bg-slate-200" />
                    <span className="text-[10px] font-bold text-slate-700">{step.userName}</span>
                    <button 
                      type="button"
                      onClick={() => removeCcUser(idx)}
                      className="text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                {ccRoute.length === 0 && (
                  <div className="text-[10px] text-slate-300 italic font-medium">指定なし</div>
                )}
              </div>
            </div>

            <div className="relative space-y-3 pl-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
              {approvalRoute.map((step, idx) => (
                <div key={idx} className="relative flex items-center gap-4 group">
                  <div className="relative z-10 w-6 h-6 rounded-full bg-white border-2 border-slate-900 flex items-center justify-center text-[10px] font-black group-hover:scale-110 transition-transform shadow-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1 flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-slate-400 transition-all group/card">
                    <img src={step.avatar} className="w-8 h-8 rounded-lg bg-slate-100" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{step.position}</div>
                      <div className="text-xs font-bold text-[#191714] truncate">{step.userName}</div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => removeApprover(idx)}
                      className="p-1 hover:bg-rose-50 rounded text-rose-300 hover:text-rose-600 opacity-0 group-hover/card:opacity-100 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="relative flex items-center gap-4">
                <div className="relative z-10 w-6 h-6 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest pl-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                  完了：管理部門へ
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={!selectedCategory || !title}
              className="w-full flex items-center justify-center gap-2 py-4 bg-[#191714] text-white rounded-2xl font-bold hover:bg-black transition-all hover:shadow-2xl hover:-translate-y-1 disabled:opacity-20 disabled:pointer-events-none"
            >
              <Send className="w-4 h-4" />
              申請を送信する
            </button>
          </div>
        </aside>
      </form>

      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowSearch(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#191714]">
                  {searchMode === 'approver' ? '承認者の検索・追加' : 'CC（共有先）の検索・追加'}
                </h3>
                <button onClick={() => setShowSearch(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-300" />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="氏名や役職で検索..."
                  className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 transition-all font-bold"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              <div className="space-y-1">
                {searchResults.map(u => (
                  <button 
                    key={u.id}
                    onClick={() => addUser(u)}
                    className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-all group text-left"
                  >
                    <img src={u.avatar} className="w-10 h-10 rounded-xl bg-slate-100 group-hover:scale-105 transition-transform" />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{u.position}</div>
                      <div className="text-sm font-bold text-[#191714]">{u.name}</div>
                    </div>
                    <Plus className="w-5 h-5 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RequestForm() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400 text-sm font-medium">フォームを読み込み中...</div>}>
      <RequestFormContent />
    </Suspense>
  );
}
