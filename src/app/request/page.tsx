'use client';

import { z } from 'zod';
import { useState, useEffect, useRef, Suspense } from 'react';
import Image from 'next/image';
import {
  Send,
  UserPlus,
  X,
  Plus,
  Search,
  ChevronDown,
  Info,
  CheckCircle2,
  FileText,
  RotateCcw,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

import { getDataProvider } from '@/lib/repository/factory';
import { Category, User, ApprovalStep, AmountRule, CustomField, FieldValidation } from '@/lib/repository/types';
import { resolveWorkflowTemplate } from '@/lib/workflow-utils';
import { useAuth } from '@/context/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFocusTrap } from '@/hooks/useFocusTrap';

const DRAFTS_KEY = 'task_bridge_drafts';
const MAX_DRAFTS = 5;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.png', '.jpg', '.jpeg', '.gif', '.txt', '.zip',
];

interface DraftEntry {
  id: string;
  title: string;
  savedAt: string;
  data: {
    title: string;
    description: string;
    priority: 'low' | 'normal' | 'high';
    largeCategory: string;
    categoryId: string | null;
    customData: Record<string, string | number>;
    ccRoute: ApprovalStep[];
  };
}

function loadDrafts(): DraftEntry[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    return raw ? (JSON.parse(raw) as DraftEntry[]) : [];
  } catch { return []; }
}

function saveDraftsToStorage(list: DraftEntry[]): void {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(list));
}

// ── Validation schemas ────────────────────────────────────────────────────────
const titleSchema = z.string().min(1, 'タイトルは必須です').max(100);
const descriptionSchema = z.string().max(2000);

function buildTextFieldSchema(v: FieldValidation): z.ZodString {
  let schema = z.string();
  if (v.minLength !== undefined) schema = schema.min(v.minLength, `${v.minLength}文字以上で入力してください`);
  if (v.maxLength !== undefined) schema = schema.max(v.maxLength, `${v.maxLength}文字以内で入力してください`);
  // Dynamic pattern validation intentionally omitted to prevent ReDoS
  return schema;
}

function RequestFormContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reuseTaskId = searchParams.get('reuseTaskId');
  const isResubmit = searchParams.get('resubmit') === 'true';
  const [categories, setCategories] = useState<Category[]>([]);
  const [largeCategory, setLargeCategory] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customData, setCustomData] = useState<Record<string, string | number>>({});
  const [approvalRoute, setApprovalRoute] = useState<ApprovalStep[]>([]);
  const [ccRoute, setCcRoute] = useState<ApprovalStep[]>([]);
  
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [taskType, setTaskType] = useState<'approval' | 'circulation'>('approval');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);

  // フォームバリデーション
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 金額閾値警告
  const [amountWarnings, setAmountWarnings] = useState<Array<{ rule: AmountRule; amount: number }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // C-1: 複数下書き保存
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [showDraftList, setShowDraftList] = useState(false);
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [pendingDraftCategoryId, setPendingDraftCategoryId] = useState<string | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // セッションごとに固有IDを生成（自動保存は同一IDで上書き）
  const draftIdRef = useRef<string>(
    Date.now().toString(36) + Math.random().toString(36).slice(2)
  );

  // For User Search (Generic for Approver and CC)
  const [showSearch, setShowSearch] = useState(false);
  const [searchMode, setSearchMode] = useState<'approver' | 'cc'>('approver');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);

  const [allUsers, setAllUsers] = useState<User[]>([]);

  const draftListModalRef = useRef<HTMLDivElement>(null);
  const searchModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(draftListModalRef, showDraftList, () => setShowDraftList(false));
  useFocusTrap(searchModalRef, showSearch, () => setShowSearch(false));

  useEffect(() => {
    const fetchInitial = async () => {
      const provider = getDataProvider();
      const [cats, usrs] = await Promise.all([provider.getCategories(), provider.getUsers()]);
      setCategories(cats);
      setAllUsers(usrs);
    };
    fetchInitial();
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

  // カテゴリー選択時: ワークフローテンプレートがあれば適用、なければ上長階層をデフォルト設定
  const applyWorkflowOrDefault = async (cat: Category | null) => {
    if (!user) return;
    const provider = getDataProvider();
    if (cat && cat.workflowTemplate && cat.workflowTemplate.length > 0) {
      const usrs = allUsers.length > 0 ? allUsers : await provider.getUsers();
      const resolved = resolveWorkflowTemplate(cat.workflowTemplate, user, usrs);
      setApprovalRoute(resolved);
    } else {
      const hierarchy = await provider.getManagerHierarchy(user.id);
      setApprovalRoute(hierarchy.map(u => ({ userId: u.id, userName: u.name, position: u.position, avatar: u.avatar, status: 'pending' as const })));
    }
  };

  // 初期デフォルト承認ルート（カテゴリー未選択時）
  useEffect(() => {
    if (user && !selectedCategory) {
      applyWorkflowOrDefault(null);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // 金額閾値ルール評価
  useEffect(() => {
    const rules = selectedCategory?.amountRules ?? [];
    if (rules.length === 0) { setAmountWarnings([]); return; }
    const triggered = rules
      .map(rule => ({ rule, amount: Number(customData[rule.fieldLabel] ?? 0) }))
      .filter(({ rule, amount }) => amount >= rule.minAmount);
    setAmountWarnings(triggered);
  }, [customData, selectedCategory]);

  // C-1: 初回マウント時に下書き一覧を確認（reuseTaskId がある場合はスキップ）
  useEffect(() => {
    if (reuseTaskId) return;
    const list = loadDrafts();
    if (list.length > 0) {
      setDrafts(list);
      setShowDraftBanner(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // C-1: 下書きの categoryId を categories ロード後に解決する
  useEffect(() => {
    if (!pendingDraftCategoryId || categories.length === 0) return;
    const cat = categories.find(c => c.id === pendingDraftCategoryId);
    if (cat) {
      if (cat.parentId) setLargeCategory(cat.parentId);
      setSelectedCategory(cat);
    }
    setPendingDraftCategoryId(null);
  }, [pendingDraftCategoryId, categories]);

  // C-1: フォーム変更を 500ms デバウンスして自動保存（reuseTaskId がある場合はスキップ）
  useEffect(() => {
    if (reuseTaskId) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      const id = draftIdRef.current;
      const entry: DraftEntry = {
        id,
        title: title || '無題の下書き',
        savedAt: new Date().toISOString(),
        data: { title, description, priority, largeCategory, categoryId: selectedCategory?.id ?? null, customData, ccRoute },
      };
      const list = loadDrafts();
      const idx = list.findIndex(d => d.id === id);
      if (idx >= 0) {
        list[idx] = entry;
      } else {
        list.push(entry);
        if (list.length > MAX_DRAFTS) list.splice(0, list.length - MAX_DRAFTS);
      }
      saveDraftsToStorage(list);
      setDrafts([...list]);
    }, 500);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [title, description, priority, largeCategory, selectedCategory?.id, customData, ccRoute, reuseTaskId]);

  const handleRestoreDraft = (draft: DraftEntry) => {
    const d = draft.data;
    if (d.title)       setTitle(d.title);
    if (d.description) setDescription(d.description);
    if (d.priority)    setPriority(d.priority);
    if (d.customData)  setCustomData(d.customData);
    if (d.ccRoute)     setCcRoute(d.ccRoute);
    if (d.categoryId)  setPendingDraftCategoryId(d.categoryId);
    else if (d.largeCategory) setLargeCategory(d.largeCategory);
    // 復元した下書きIDをセッションIDとして引き継ぐ（以降の自動保存は同エントリを上書き）
    draftIdRef.current = draft.id;
    setShowDraftList(false);
    setShowDraftBanner(false);
  };

  const handleDeleteDraft = (id: string) => {
    const list = loadDrafts().filter(d => d.id !== id);
    saveDraftsToStorage(list);
    setDrafts(list);
    if (list.length === 0) setShowDraftBanner(false);
  };

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

  /** ステップの並列タイプを切り替える（直列 → AND → OR → 直列） */
  const cycleParallelType = (index: number) => {
    if (index === 0) return; // 最初のステップは変更不可
    const next = approvalRoute.map((s, i) => {
      if (i !== index) return s;
      const current = s.parallelType;
      const nextType: 'and' | 'or' | undefined =
        current === undefined ? 'and' : current === 'and' ? 'or' : undefined;
      return { ...s, parallelType: nextType };
    });
    setApprovalRoute(next);
  };

  /** 送信前に stageIndex を parallelType の隣接関係から計算して付与 */
  const buildFinalRoute = (route: ApprovalStep[]): ApprovalStep[] => {
    let stage = 0;
    return route.map((step, idx) => {
      if (idx === 0) return { ...step, stageIndex: stage };
      if (step.parallelType === 'and' || step.parallelType === 'or') {
        return { ...step, stageIndex: stage };
      }
      stage++;
      return { ...step, stageIndex: stage, parallelType: undefined };
    });
  };

  const addFiles = (incoming: File[]) => {
    const errors: string[] = [];
    const valid: File[] = [];
    for (const file of incoming) {
      const ext = ('.' + file.name.split('.').pop()).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        errors.push(`${file.name}：許可されていないファイル形式です（${ext}）`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`${file.name}：ファイルサイズが10MBを超えています（${(file.size / 1024 / 1024).toFixed(1)}MB）`);
        continue;
      }
      valid.push(file);
    }
    setFileErrors(errors);
    if (valid.length > 0) setAttachedFiles(prev => [...prev, ...valid]);
  };

  /** 単一フィールドのバリデーション。エラーメッセージを返す（問題なければ空文字） */
  const validateField = (fieldId: string, value: string | number, field?: CustomField): string => {
    const strVal = String(value ?? '').trim();

    if (fieldId === '__title') {
      const result = titleSchema.safeParse(strVal);
      if (!result.success) {
        if (strVal.length > 100) return `タイトルは100文字以内で入力してください（現在 ${strVal.length} 文字）`;
        return result.error.issues[0].message;
      }
      return '';
    }

    if (fieldId === '__description') {
      const result = descriptionSchema.safeParse(strVal);
      if (!result.success) return `詳細説明は2000文字以内で入力してください（現在 ${strVal.length} 文字）`;
      return '';
    }

    if (!field) return '';
    if (field.required && !strVal) return `${field.label}は必須です`;
    if (!strVal) return '';

    if (field.type === 'number') {
      const num = Number(value);
      if (isNaN(num)) return '数値を入力してください';
      const v = field.validation ?? {};
      if (v.min !== undefined && num < v.min) return `${v.min} 以上の値を入力してください`;
      if (v.max !== undefined && num > v.max) return `${v.max} 以下の値を入力してください`;
      return '';
    }

    if (field.validation) {
      const result = buildTextFieldSchema(field.validation).safeParse(strVal);
      if (!result.success) return result.error.issues[0]?.message ?? '';
    }

    return '';
  };

  /** 全フィールドを検証してエラーマップを返す。空なら合格 */
  const validateAllFields = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const titleErr = validateField('__title', title);
    if (titleErr) errors['__title'] = titleErr;
    const descErr = validateField('__description', description);
    if (descErr) errors['__description'] = descErr;
    selectedCategory?.customFields?.forEach(field => {
      const err = validateField(field.id, customData[field.label] ?? '', field);
      if (err) errors[field.id] = err;
    });
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !title) return;

    const errors = validateAllFields();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // 最初のエラーフィールドへスクロール
      const firstKey = Object.keys(errors)[0];
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setFieldErrors({});

    const provider = getDataProvider();

    const finalRoute = buildFinalRoute(approvalRoute);

    if (isResubmit && reuseTaskId) {
      // B-1: 既存タスクをリセットして再送信
      const pendingRoute = finalRoute.map(s => ({ ...s, status: 'pending' as const }));
      const firstPending = pendingRoute[0];
      await provider.updateTask(reuseTaskId, {
        title,
        description: description || '',
        categoryId: selectedCategory.id,
        targetDepartmentId: selectedCategory.targetDepartmentId,
        priority,
        taskType,
        approvalRoute: pendingRoute,
        ccRoute,
        customData,
        statusId: 'status_todo',
        status: 'todo',
        currentApproverId: firstPending?.userId,
        currentApproverName: firstPending?.userName,
      });
      await provider.addComment(reuseTaskId, user?.id || '', '申請者により内容が修正され、再申請されました。');
    } else {
      await provider.createTask({
        title,
        description: description || '',
        requesterId: user?.id || '',
        categoryId: selectedCategory.id,
        targetDepartmentId: selectedCategory.targetDepartmentId,
        priority,
        taskType,
        approvalRoute: finalRoute,
        ccRoute,
        customData
      });
    }

    // 送信したセッションの下書きを削除
    const remainingDrafts = loadDrafts().filter(d => d.id !== draftIdRef.current);
    saveDraftsToStorage(remainingDrafts);
    router.push('/tracker');
  };

  const largeCategoryOptions = categories.filter(c => c.parentId === null);
  const mediumCategoryOptions = categories.filter(c => c.parentId === largeCategory);

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-6">
      <header className="flex flex-col gap-1 border-b pb-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#191714]">新規申請・相談</h1>
        <p className="text-slate-500 font-medium font-bold">依頼内容を入力し、承認ルートを確認して送信してください。</p>

        {/* C-1: 下書き通知バナー */}
        {showDraftBanner && (
          <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl animate-in slide-in-from-top-2 duration-300">
            <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="flex-1 text-sm font-bold text-amber-800">
              {drafts.length}件の下書きが保存されています
            </p>
            <button
              type="button"
              onClick={() => setShowDraftList(true)}
              className="text-xs font-black text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-1 rounded-lg transition-colors"
            >
              一覧を見る
            </button>
            <button
              type="button"
              onClick={() => setShowDraftBanner(false)}
              className="p-1 text-amber-400 hover:text-amber-700 transition-colors"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {/* 申請タイプ選択 */}
      <div className="flex gap-2 pb-1">
        {([
          { value: 'approval', label: '承認申請', desc: '承認・差し戻しが必要な申請' },
          { value: 'circulation', label: '回覧', desc: '全員確認のみ（差し戻しなし）' },
        ] as const).map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTaskType(opt.value)}
            className={`flex-1 max-w-xs py-3 px-4 rounded-2xl border-2 text-left transition-all ${
              taskType === opt.value
                ? 'border-slate-900 bg-slate-50'
                : 'border-slate-100 hover:border-slate-200 bg-white'
            }`}
            aria-pressed={taskType === opt.value}
          >
            <div className={`text-xs font-black ${taskType === opt.value ? 'text-slate-900' : 'text-slate-500'}`}>{opt.label}</div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5">{opt.desc}</div>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Categories */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
              <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-slate-900 border">1</span>
              カテゴリー選択
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="req-large-category" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">大分類</label>
                <div className="relative group">
                  <select
                    id="req-large-category"
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
                  <ChevronDown className="absolute right-3 top-3.5 w-5 h-5 text-slate-500 pointer-events-none group-hover:text-slate-600 transition-colors" />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="req-medium-category" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">中分類</label>
                <div className="relative group">
                  <select
                    id="req-medium-category"
                    className="w-full h-12 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-bold text-slate-900 disabled:opacity-50"
                    disabled={!largeCategory}
                    onChange={(e) => {
                      const cat = categories.find(c => c.id === e.target.value) ?? null;
                      setSelectedCategory(cat);
                      setCustomData({});
                      applyWorkflowOrDefault(cat);
                    }}
                    value={selectedCategory?.id || ''}
                  >
                    <option value="">選択してください</option>
                    {mediumCategoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-3.5 w-5 h-5 text-slate-500 pointer-events-none group-hover:text-slate-600 transition-colors" />
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
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
              <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-slate-900 border">2</span>
              申請内容の詳細
            </div>
            <div className="space-y-4">
              {/* A-1: 優先度 */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">優先度</label>
                <div className="flex gap-2">
                  {([
                    { value: 'low',    label: '低',   className: 'border-sky-200 text-sky-500 bg-sky-50' },
                    { value: 'normal', label: '通常', className: 'border-slate-200 text-slate-500 bg-slate-50' },
                    { value: 'high',   label: '急ぎ', className: 'border-rose-200 text-rose-700 bg-rose-50' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPriority(opt.value)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black border-2 transition-all ${
                        priority === opt.value
                          ? opt.className + ' ring-2 ring-offset-1 ring-current'
                          : 'border-slate-100 text-slate-500 bg-white hover:border-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2" id="field-__title">
                <label htmlFor="req-title" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">タイトル <span className="text-rose-600">*</span></label>
                <input
                  id="req-title"
                  type="text"
                  placeholder="例：2026年度 資格取得祝金申請"
                  className={`w-full h-12 px-4 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-bold text-slate-900 ${fieldErrors['__title'] ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-200'}`}
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); if (fieldErrors['__title']) setFieldErrors(p => ({ ...p, __title: '' })); }}
                  aria-invalid={!!fieldErrors['__title']}
                  aria-describedby={fieldErrors['__title'] ? 'err-__title' : undefined}
                />
                {fieldErrors['__title'] && <p id="err-__title" className="text-xs text-rose-600 font-bold px-1">{fieldErrors['__title']}</p>}
              </div>
              <div className="space-y-2" id="field-__description">
                <label htmlFor="req-description" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">詳細説明 / 追記</label>
                <textarea
                  id="req-description"
                  rows={6}
                  placeholder="申請の背景、希望する対応内容などを記載してください。"
                  className={`w-full p-4 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium text-slate-900 resize-none ${fieldErrors['__description'] ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-200'}`}
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); if (fieldErrors['__description']) setFieldErrors(p => ({ ...p, __description: '' })); }}
                  aria-invalid={!!fieldErrors['__description']}
                  aria-describedby={fieldErrors['__description'] ? 'err-__description' : undefined}
                />
                {fieldErrors['__description'] && <p id="err-__description" className="text-xs text-rose-600 font-bold px-1">{fieldErrors['__description']}</p>}
              </div>

              {/* Dynamic Fields Section */}
              {selectedCategory?.customFields && selectedCategory.customFields.length > 0 && (
                <div className="pt-6 mt-6 border-t border-slate-100 space-y-4 animate-in fade-in duration-500">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                    <h3 className="text-sm font-bold text-[#191714]">追加入力項目</h3>
                  </div>
                  <div className="space-y-4">
                    {selectedCategory.customFields.map((field) => {
                      const hasErr = !!fieldErrors[field.id];
                      const errId = `err-${field.id}`;
                      const inputClass = (base: string) =>
                        `${base} ${hasErr ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-200'}`;
                      const handleChange = (val: string) => {
                        setCustomData({ ...customData, [field.label]: val });
                        if (hasErr) setFieldErrors(p => ({ ...p, [field.id]: '' }));
                      };
                      return (
                        <div key={field.id} className="space-y-2" id={`field-${field.id}`}>
                          <label
                            htmlFor={!['checkbox', 'file'].includes(field.type) ? `custom-field-${field.id}` : undefined}
                            className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1"
                          >
                            {field.label}
                            {field.required && <span className="text-rose-600 ml-1">*</span>}
                          </label>

                          {field.type === 'select' ? (
                            <div className="relative">
                              <select
                                id={`custom-field-${field.id}`}
                                className={inputClass('w-full h-12 pl-4 pr-10 bg-slate-50 border rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-bold text-slate-900')}
                                value={customData[field.label] || ''}
                                onChange={(e) => handleChange(e.target.value)}
                                aria-invalid={hasErr}
                                aria-describedby={hasErr ? errId : undefined}
                              >
                                <option value="">選択してください</option>
                                {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                              <ChevronDown className="absolute right-3 top-3.5 w-5 h-5 text-slate-500 pointer-events-none" />
                            </div>
                          ) : field.type === 'textarea' ? (
                            <textarea
                              id={`custom-field-${field.id}`}
                              rows={3}
                              className={inputClass('w-full px-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-sm text-slate-900 resize-none')}
                              placeholder={field.placeholder ?? `${field.label}を入力...`}
                              value={customData[field.label] || ''}
                              onChange={(e) => handleChange(e.target.value)}
                              aria-invalid={hasErr}
                              aria-describedby={hasErr ? errId : undefined}
                            />
                          ) : field.type === 'checkbox' ? (
                            <label className="flex items-center gap-3 h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-slate-400 transition-all">
                              <input
                                type="checkbox"
                                checked={!!customData[field.label]}
                                onChange={(e) => setCustomData({ ...customData, [field.label]: e.target.checked ? '1' : '' })}
                                className="w-4 h-4 accent-slate-900"
                              />
                              <span className="text-sm font-bold text-slate-700">確認しました</span>
                            </label>
                          ) : field.type === 'file' ? (
                            <label className={inputClass('flex items-center gap-2 h-12 px-4 bg-slate-50 border rounded-xl cursor-pointer hover:border-slate-400 transition-all text-sm text-slate-500 font-bold')}>
                              <input type="file" className="hidden" onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleChange(f.name);
                              }} />
                              {customData[field.label] ? String(customData[field.label]) : 'ファイルを選択...'}
                            </label>
                          ) : field.type === 'date' ? (
                            <input
                              id={`custom-field-${field.id}`}
                              type="date"
                              className={inputClass('w-full h-12 px-4 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-bold text-slate-900')}
                              value={customData[field.label] || ''}
                              onChange={(e) => handleChange(e.target.value)}
                              aria-invalid={hasErr}
                              aria-describedby={hasErr ? errId : undefined}
                            />
                          ) : (
                            <input
                              id={`custom-field-${field.id}`}
                              type={field.type === 'number' ? 'number' : 'text'}
                              className={inputClass('w-full h-12 px-4 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-bold text-slate-900')}
                              placeholder={field.placeholder ?? `${field.label}を入力...`}
                              value={customData[field.label] || ''}
                              onChange={(e) => handleChange(e.target.value)}
                              aria-invalid={hasErr}
                              aria-describedby={hasErr ? errId : undefined}
                            />
                          )}
                          {hasErr && <p id={errId} className="text-xs text-rose-600 font-bold px-1">{fieldErrors[field.id]}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* 金額閾値警告バナー */}
              {amountWarnings.length > 0 && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                  {amountWarnings.map(({ rule, amount }) => (
                    <div key={rule.fieldLabel} className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-amber-800">
                          {rule.message ?? `¥${amount.toLocaleString()} は閾値（¥${rule.minAmount.toLocaleString()}）を超えています`}
                        </p>
                        <p className="text-[10px] font-bold text-amber-600 mt-0.5">
                          <span className="font-black">{rule.requiredPosition}</span> の承認が必要です。承認ルートに追加してください。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const provider = getDataProvider();
                          const allUsers = await provider.getUsers();
                          const candidate = allUsers.find(u =>
                            u.position === rule.requiredPosition && u.status === 'active' &&
                            !approvalRoute.some(s => s.userId === u.id)
                          );
                          if (candidate) {
                            setApprovalRoute(prev => [...prev, {
                              userId: candidate.id,
                              userName: candidate.name,
                              position: candidate.position,
                              avatar: candidate.avatar,
                              status: 'pending',
                            }]);
                          } else {
                            setSearchMode('approver');
                            setShowSearch(true);
                          }
                        }}
                        className="shrink-0 text-[10px] font-black text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        追加
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(Array.from(e.dataTransfer.files));
                }}
                className="flex items-center gap-2 p-4 mt-4 bg-slate-50 border border-dashed rounded-xl text-slate-500 cursor-pointer hover:bg-slate-100 hover:text-slate-600 transition-all"
              >
                <Plus className="w-4 h-4 ml-auto" />
                <span className="text-xs font-bold mr-auto">ファイルを添付またはドラッグ＆ドロップ</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files || []));
                  e.target.value = '';
                }}
              />
              {attachedFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {attachedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600">
                      <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="text-slate-500 shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="text-slate-500 hover:text-rose-600 transition-colors"
                        aria-label={`${file.name}を削除`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {fileErrors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {fileErrors.map((err, idx) => (
                    <p key={idx} className="text-xs text-rose-600 font-bold px-1">{err}</p>
                  ))}
                  <p className="text-[10px] text-slate-500 px-1">
                    許可形式: {ALLOWED_EXTENSIONS.join(', ')} ／ 上限: 10MB
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Section 3: Approval Route */}
        <aside className="space-y-6">
          <div className="sticky top-24 space-y-8">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
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
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CC（共有先）</div>
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
                    {step.avatar
                      ? <Image src={step.avatar} width={16} height={16} alt="" className="w-4 h-4 rounded-full bg-slate-200" />
                      : <div className="w-4 h-4 rounded-full bg-slate-200" />
                    }
                    <span className="text-[10px] font-bold text-slate-700">{step.userName}</span>
                    <button 
                      type="button"
                      onClick={() => removeCcUser(idx)}
                      className="text-slate-500 hover:text-rose-600 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                {ccRoute.length === 0 && (
                  <div className="text-[10px] text-slate-500 italic font-medium">指定なし</div>
                )}
              </div>
            </div>

            <div className="relative space-y-3 pl-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
              {approvalRoute.map((step, idx) => (
                <div key={idx} className="relative flex items-start gap-4 group">
                  <div className="relative z-10 w-6 h-6 mt-3 rounded-full bg-white border-2 border-slate-900 flex items-center justify-center text-[10px] font-black group-hover:scale-110 transition-transform shadow-sm shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* 並列バッジ（ステップ1以降） */}
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => cycleParallelType(idx)}
                        className={`mb-1.5 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border transition-all ${
                          step.parallelType === 'and'
                            ? 'bg-violet-50 border-violet-200 text-violet-600'
                            : step.parallelType === 'or'
                            ? 'bg-amber-50 border-amber-200 text-amber-600'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-500'
                        }`}
                        title="クリックして並列設定を変更: なし → AND（全員承認）→ OR（1名でOK）"
                      >
                        {step.parallelType === 'and' ? '並列 AND' : step.parallelType === 'or' ? '並列 OR' : '+ 並列化'}
                      </button>
                    )}
                    <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-slate-400 transition-all group/card">
                      {step.avatar
                        ? <Image src={step.avatar} width={32} height={32} alt="" className="w-8 h-8 rounded-lg bg-slate-100" />
                        : <div className="w-8 h-8 rounded-lg bg-slate-100" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{step.position}</div>
                        <div className="text-xs font-bold text-[#191714] truncate">{step.userName}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeApprover(idx)}
                        className="p-1 hover:bg-rose-50 rounded text-rose-300 hover:text-rose-600 opacity-0 group-hover/card:opacity-100 transition-all"
                        aria-label={`${step.userName}を削除`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
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
              {isResubmit ? '修正内容を再申請する' : '申請を送信する'}
            </button>
          </div>
        </aside>
      </form>

      {/* C-1: 下書き一覧モーダル */}
      {showDraftList && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowDraftList(false)} aria-hidden="true" />
          <div
            ref={draftListModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="draft-list-modal-title"
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
          >
            <div className="p-6 border-b flex items-center justify-between">
              <h3 id="draft-list-modal-title" className="text-lg font-bold text-[#191714]">保存済み下書き</h3>
              <button type="button" onClick={() => setShowDraftList(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="閉じる">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto p-3 space-y-2">
              {drafts.length === 0 && (
                <p className="text-center text-sm text-slate-500 py-8">下書きはありません</p>
              )}
              {drafts.map((draft) => {
                const savedAt = new Date(draft.savedAt);
                const dateLabel = isNaN(savedAt.getTime())
                  ? '--'
                  : savedAt.toLocaleDateString('ja-JP') + ' ' + savedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={draft.id} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl group hover:border-slate-400 transition-all">
                    <FileText className="w-5 h-5 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-[#191714] truncate">{draft.title}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{dateLabel}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestoreDraft(draft)}
                      className="text-[11px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors shrink-0"
                    >
                      復元
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDraft(draft.id)}
                      className="p-1 text-slate-500 hover:text-rose-600 transition-colors shrink-0"
                      aria-label="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowSearch(false)} aria-hidden="true" />
          <div
            ref={searchModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-modal-title"
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
          >
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <h3 id="search-modal-title" className="text-lg font-bold text-[#191714]">
                  {searchMode === 'approver' ? '承認者の検索・追加' : 'CC（共有先）の検索・追加'}
                </h3>
                <button type="button" onClick={() => setShowSearch(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="閉じる">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  autoFocus
                  aria-label="ユーザーを検索"
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
                    {u.avatar
                      ? <Image src={u.avatar} width={40} height={40} alt="" className="w-10 h-10 rounded-xl bg-slate-100 group-hover:scale-105 transition-transform" />
                      : <div className="w-10 h-10 rounded-xl bg-slate-100" />
                    }
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{u.position}</div>
                      <div className="text-sm font-bold text-[#191714]">{u.name}</div>
                    </div>
                    <Plus className="w-5 h-5 text-slate-500 opacity-0 group-hover:opacity-100 transition-all" />
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
    <Suspense fallback={<div className="p-8 text-slate-500 text-sm font-medium">フォームを読み込み中...</div>}>
      <RequestFormContent />
    </Suspense>
  );
}
