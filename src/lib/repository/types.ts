export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  departmentId: string; // back-office dept (if admin)
  orgUnitId: string;   // organizational unit (Division/Group/Team)
  managerId: string | null;
  position: string;    // President, Division Manager, GM, TL, Member
  avatar?: string;
  status: 'active' | 'inactive' | 'on_leave';
  joinedAt: string;
  leftAt?: string;
}

export interface OrganizationUnit {
  id: string;
  name: string;
  type: 'division' | 'group' | 'team' | 'root';
  parentId: string | null;
  status: 'active' | 'archived';
}

export interface UserChangeEvent {
  id: string;
  targetType: 'user' | 'unit';
  targetId: string;
  eventType: 'join' | 'transfer' | 'promotion' | 'leave' | 'retire' | 'unit_create' | 'unit_update' | 'unit_archive';
  scheduledAt: string;
  appliedAt?: string;
  status: 'pending' | 'applied' | 'cancelled';
  changes: Record<string, unknown>;
  note?: string;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;       // regex string
  patternMessage?: string; // error message when pattern fails
}

export interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'file';
  options?: string[];
  required: boolean;
  placeholder?: string;
  validation?: FieldValidation;
}

export type ApproverType =
  | 'direct_manager'
  | 'second_manager'
  | 'third_manager'
  | 'specific_user'
  | 'role'
  | 'approval_group';

/** カテゴリーに紐づく承認ワークフローのステップテンプレート */
export interface WorkflowStepTemplate {
  id: string;
  label: string;
  approverType: ApproverType;
  approverUserId?: string;
  approverRole?: string;
  approverGroupIds?: string[];
  parallelType?: 'or' | 'and';
  stageIndex: number;
}

/** 承認権限金額閾値ルール: 指定フィールドの金額が minAmount 以上のとき、requiredPosition の承認者追加を警告 */
export interface AmountRule {
  fieldLabel: string;         // CustomField.label と一致させる
  minAmount: number;          // この金額（以上）でルール適用
  requiredPosition: string;   // 必要な役職 (e.g. 'Division Manager')
  message?: string;           // カスタム警告メッセージ（省略時はデフォルト）
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  targetDepartmentId: string;
  slaDays?: number;
  customFields: CustomField[];
  workflowTemplate: WorkflowStepTemplate[];
  amountRules?: AmountRule[];
}

export interface ApprovalStep {
  userId: string;
  userName: string;
  position?: string;
  avatar?: string;
  status: 'pending' | 'approved' | 'rejected';
  comment?: string;
  processedAt?: string;
  /** 並列承認グループID（同じ stageIndex のステップが同一グループ） */
  stageIndex?: number;
  /** 並列承認タイプ: 'and' = 全員承認, 'or' = 1名承認で完了 */
  parallelType?: 'and' | 'or';
  /** 代決で処理した場合の代理者 userId */
  delegatedBy?: string;
}

/** 代決（代理承認）設定 */
export interface Delegation {
  id: string;
  delegatorId: string;  // 権限を委任する人
  delegateId: string;   // 代理で承認する人
  startDate: string;
  endDate?: string;
  reason?: string;
  isActive: boolean;
}

export interface AuditLog {
  id: string;
  taskId: string;
  userId: string;
  userName?: string;
  action: string;
  comment?: string;
  timestamp: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  requesterId: string;
  targetDepartmentId: string;
  categoryId: string;
  category?: string; // Display name
  statusId: string;
  status: 'todo' | 'in_progress' | 'completed';
  priority: 'low' | 'normal' | 'high';
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  approvalRoute: ApprovalStep[];
  ccRoute?: ApprovalStep[];
  currentApproverId?: string;
  currentApproverName?: string;
  customData?: Record<string, string | number>;
  /** 'approval' = 通常の承認申請, 'circulation' = 回覧（全員確認のみ） */
  taskType?: 'approval' | 'circulation';
}

export interface Status {
  id: string;
  label: string;
  color: string;
}

export interface Department {
  id: string;
  name: string;
}

export interface DataProvider {
  getTasks(): Promise<Task[]>;
  getTaskById(id: string): Promise<Task | null>;
  createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'dueDate' | 'statusId' | 'status'>): Promise<Task>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task>;
  processApproval(taskId: string, userId: string, action: 'approve' | 'reject' | 'acknowledge', comment?: string): Promise<Task>;
  addComment(taskId: string, userId: string, comment: string): Promise<void>;
  getUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  getDepartments(): Promise<Department[]>;
  getOrganizationUnits(): Promise<OrganizationUnit[]>;
  getCategories(): Promise<Category[]>;
  getStatuses(): Promise<Status[]>;
  getCurrentUser(): Promise<User | null>;
  getAuditLogs(taskId: string): Promise<AuditLog[]>;
  getAllAuditLogs(): Promise<AuditLog[]>;
  getManagerHierarchy(userId: string): Promise<User[]>;
  // 人事・組織変更関連
  getUserChangeEvents(): Promise<UserChangeEvent[]>;
  scheduleUserChange(event: Omit<UserChangeEvent, 'id' | 'status'>): Promise<UserChangeEvent>;
  applyUserChange(eventId: string): Promise<void>;
  reassignTasks(oldUserId: string, newUserId: string): Promise<void>;
  importBulkData(type: 'units' | 'users', csvContent: string): Promise<{ count: number; errors: string[] }>;
  // ユーザー・カテゴリー CRUD
  createUser(data: Omit<User, 'id'>): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  createCategory(data: Omit<Category, 'id'>): Promise<Category>;
  updateCategory(id: string, data: Partial<Category>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  // 組織ユニット CRUD
  createOrganizationUnit(data: Omit<OrganizationUnit, 'id'>): Promise<OrganizationUnit>;
  updateOrganizationUnit(id: string, data: Partial<OrganizationUnit>): Promise<OrganizationUnit>;
  archiveOrganizationUnit(id: string): Promise<void>;
  // 承認ルート変更
  updateApprovalRoute(taskId: string, stepIndex: number, newApproverId: string): Promise<Task>;
  // 代決（代理承認）
  getDelegations(): Promise<Delegation[]>;
  createDelegation(data: Omit<Delegation, 'id'>): Promise<Delegation>;
  revokeDelegation(id: string): Promise<void>;
}
