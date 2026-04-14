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

export interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[]; // For select type
  required: boolean;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  targetDepartmentId: string;
  slaDays?: number;
  customFields?: CustomField[];
}

export interface ApprovalStep {
  userId: string;
  userName: string;
  position?: string;
  avatar?: string;
  status: 'pending' | 'approved' | 'rejected';
  comment?: string;
  processedAt?: string;
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
  processApproval(taskId: string, userId: string, action: 'approve' | 'reject', comment?: string): Promise<Task>;
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
}
