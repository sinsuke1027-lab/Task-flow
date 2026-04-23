import { DataProvider, Task, User, Department, Status, OrganizationUnit, Category, AuditLog, ApprovalStep, UserChangeEvent, Delegation } from './types';
import tasksData from '@/mocks/tasks.json';
import usersData from '@/mocks/users.json';
import departmentsData from '@/mocks/departments.json';
import statusesData from '@/mocks/statuses.json';
import orgUnitsData from '@/mocks/org_units.json';
import categoriesData from '@/mocks/categories.json';

export class MockDataProvider implements DataProvider {
  private tasks: Task[];
  private users: User[];
  private departments: Department[] = [...departmentsData] as Department[];
  private statuses: Status[] = [...statusesData] as Status[];
  private orgUnits: OrganizationUnit[];
  private categories: Category[] = [...categoriesData] as Category[];
  private auditLogs: AuditLog[] = [];
  private userChangeEvents: UserChangeEvent[] = [];
  private delegations: Delegation[] = [];
  private currentUser: User;

  constructor() {
    // ─── LocalStorage 永続化: 保存済み状態の復元 ──────────────────
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tb_state');
      if (saved) {
        try {
          const state = JSON.parse(saved) as {
            version: number; users: User[]; orgUnits: OrganizationUnit[];
            categories: Category[]; tasks: Task[]; auditLogs: AuditLog[];
            userChangeEvents: UserChangeEvent[];
          };
          if (state.version === 1 && Array.isArray(state.users) && state.users.length > 0) {
            this.users = state.users;
            this.orgUnits = state.orgUnits ?? [];
            this.categories = state.categories ?? this.categories;
            this.tasks = state.tasks ?? [];
            this.auditLogs = state.auditLogs ?? [];
            this.userChangeEvents = state.userChangeEvents ?? [];
            this.delegations = (state as Record<string, unknown>).delegations as Delegation[] ?? [];
            this.currentUser = this.users.find(u => u.id === 'user_admin_1') || this.users[0];
            return;
          }
        } catch {
          localStorage.removeItem('tb_state');
        }
      }
    }
    // ──────────────────────────────────────────────────────────────

    // Initialize users with defaults for new fields
    this.users = (usersData as Record<string, unknown>[]).map(u => {
      const rawRole = (u.role as string) || 'user';
      // Normalize roles: only strictly 'admin' positions get the 'admin' system role
      const normalizedRole: User['role'] = (rawRole === 'admin') ? 'admin' : 'user';
      
      return {
        id: (u.id as string) || '',
        name: (u.name as string) || '',
        email: (u.email as string) || '',
        role: normalizedRole,
        departmentId: (u.departmentId as string) || '',
        orgUnitId: (u.orgUnitId as string) || '',
        managerId: (u.managerId as string) || null,
        position: (u.position as string) || 'Member',
        avatar: (u.avatar as string) || undefined,
        status: (u.status as User['status']) || 'active',
        joinedAt: (u.joinedAt as string) || '2023-01-01T00:00:00Z',
        leftAt: (u.leftAt as string) || undefined
      };
    });

    // Initialize units with defaults
    this.orgUnits = (orgUnitsData as Record<string, unknown>[]).map(u => ({
      id: (u.id as string) || '',
      name: (u.name as string) || '',
      type: (u.type as OrganizationUnit['type']) || 'team',
      parentId: (u.parentId as string) || null,
      status: (u.status as OrganizationUnit['status']) || 'active'
    }));

    // Set current user (will be overridden by login)
    this.currentUser = this.users.find(u => u.id === 'user_admin_1') || this.users[0];

    // Initialize tasks with proper mapping
    this.tasks = (tasksData as Record<string, unknown>[]).map(t => this.enrichTask(t));

    // JSON から初期化した場合はストレージに保存
    this.saveToStorage();
  }

  public setCurrentUser(userId: string): void {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      this.currentUser = user;
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('tb_state', JSON.stringify({
        version: 1,
        users: this.users,
        orgUnits: this.orgUnits,
        categories: this.categories,
        tasks: this.tasks,
        auditLogs: this.auditLogs.slice(-500),
        userChangeEvents: this.userChangeEvents,
        delegations: this.delegations,
      }));
    } catch (e) {
      console.warn('TaskFlow: ストレージへの保存に失敗しました', e);
    }
  }

  /** モックデータをリセットしてJSON初期値に戻す（開発用） */
  public clearStorage(): void {
    if (typeof window !== 'undefined') localStorage.removeItem('tb_state');
  }

  private enrichTask(task: Record<string, unknown>): Task {
    const categoryId = task.categoryId as string;
    const statusId = task.statusId as string;
    const category = this.categories.find(c => c.id === categoryId);
    
    const rawRoute = (task.approvalRoute || task.approvalSteps) as Record<string, unknown>[] || [];
    const enrichedRoute: ApprovalStep[] = rawRoute.map((step: Record<string, unknown>) => {
      const approverId = (step.approverId || step.userId) as string;
      const approver = this.users.find(u => u.id === approverId);
      return {
        userId: approverId,
        userName: (step.userName as string) || approver?.name || 'Unknown',
        position: (step.position as string) || approver?.position,
        avatar: (step.avatar as string) || approver?.avatar,
        status: (step.status as ApprovalStep['status']) || 'pending',
        comment: step.comment as string,
        processedAt: step.processedAt as string,
        stageIndex: step.stageIndex as number | undefined,
        parallelType: step.parallelType as ApprovalStep['parallelType'],
        delegatedBy: step.delegatedBy as string | undefined,
      };
    });
    
    const rawCcRoute = (task.ccRoute || task.ccUserIds) as Record<string, unknown>[] || [];
    const enrichedCcRoute: ApprovalStep[] = rawCcRoute.map((step: Record<string, unknown>) => {
      const ccUserId = (step.userId || (typeof step === 'string' ? step : undefined)) as string;
      const ccUser = this.users.find(u => u.id === ccUserId);
      return {
        userId: ccUserId,
        userName: (step.userName as string) || ccUser?.name || 'Unknown',
        position: (step.position as string) || ccUser?.position,
        avatar: (step.avatar as string) || ccUser?.avatar,
        status: 'pending' // status is dummy for CC
      };
    });

    return {
      id: task.id as string,
      title: task.title as string,
      description: task.description as string,
      requesterId: (task.requesterId || task.requestorId) as string,
      targetDepartmentId: task.targetDepartmentId as string,
      categoryId: categoryId,
      statusId: statusId,
      priority: (task.priority as Task['priority']) || 'normal',
      createdAt: task.createdAt as string,
      updatedAt: task.updatedAt as string,
      dueDate: task.dueDate as string,
      category: category?.name || '未分類',
      status: (statusId === 'status_done' ? 'completed' : statusId === 'status_working' ? 'in_progress' : 'todo') as Task['status'],
      approvalRoute: enrichedRoute,
      ccRoute: enrichedCcRoute,
      currentApproverId: enrichedRoute.find(s => s.status === 'pending')?.userId,
      currentApproverName: enrichedRoute.find(s => s.status === 'pending')?.userName,
      customData: task.customData as Record<string, string | number>,
      taskType: (task.taskType as Task['taskType']) || 'approval',
    };
  }

  async getTasks(): Promise<Task[]> {
    return this.tasks;
  }

  async getTaskById(id: string): Promise<Task | null> {
    return this.tasks.find(t => t.id === id) || null;
  }

  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'dueDate' | 'statusId' | 'status'>): Promise<Task> {
    const category = this.categories.find(c => c.id === task.categoryId);
    const createdAt = new Date();
    const dueDate = new Date(createdAt);
    dueDate.setDate(dueDate.getDate() + (category?.slaDays || 5));

    const approvalRoute = task.approvalRoute || [];
    const ccRoute = task.ccRoute || [];
    const pendingRoute = approvalRoute.map(s => ({ ...s, status: 'pending' as const }));
    const firstPending = pendingRoute.find(s => s.status === 'pending');
    const newTask: Task = {
      ...task,
      id: `task_${Math.random().toString(36).substr(2, 9)}`,
      statusId: 'status_todo',
      status: 'todo',
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      dueDate: dueDate.toISOString(),
      approvalRoute: pendingRoute,
      ccRoute: ccRoute,
      currentApproverId: firstPending?.userId,
      currentApproverName: firstPending?.userName
    };

    this.tasks.push(newTask);

    // Add Audit Log
    this.auditLogs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      taskId: newTask.id,
      userId: newTask.requesterId,
      userName: this.users.find(u => u.id === newTask.requesterId)?.name || 'Unknown',
      action: 'submit',
      comment: '申請が提出されました。',
      timestamp: createdAt.toISOString()
    });

    this.saveToStorage();
    return newTask;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Task not found');
    
    this.tasks[index] = { ...this.tasks[index], ...updates, updatedAt: new Date().toISOString() };
    this.saveToStorage();
    return this.tasks[index];
  }

  async processApproval(taskId: string, userId: string, action: 'approve' | 'reject' | 'acknowledge', comment?: string): Promise<Task> {
    const task = await this.getTaskById(taskId);
    if (!task) throw new Error('Task not found');

    // ── 代決チェック: userId が delegate の場合、delegator のステップを処理 ──
    let stepIndex = task.approvalRoute.findIndex(s => s.userId === userId && s.status === 'pending');
    let delegatedBy: string | undefined;

    if (stepIndex === -1) {
      const delegation = this.delegations.find(d =>
        d.delegateId === userId && d.isActive &&
        task.approvalRoute.some(s => s.userId === d.delegatorId && s.status === 'pending'),
      );
      if (delegation) {
        stepIndex = task.approvalRoute.findIndex(s => s.userId === delegation.delegatorId && s.status === 'pending');
        delegatedBy = userId;
      }
    }

    if (stepIndex === -1) throw new Error('No pending approval for this user');

    const step = task.approvalRoute[stepIndex];
    const isCirculation = task.taskType === 'circulation';

    // 回覧は 'acknowledge' として扱い、常に approved 扱い
    const resolvedStatus: 'approved' | 'rejected' =
      isCirculation || action === 'approve' || action === 'acknowledge' ? 'approved' : 'rejected';

    task.approvalRoute[stepIndex] = {
      ...step,
      status: resolvedStatus,
      comment,
      processedAt: new Date().toISOString(),
      ...(delegatedBy ? { delegatedBy } : {}),
    };

    const auditAction = action === 'acknowledge' ? 'acknowledge' : action;

    if (resolvedStatus === 'rejected') {
      // 差し戻し
      task.statusId = 'status_rejected';
      task.status = 'todo';
      task.currentApproverId = undefined;
      task.currentApproverName = undefined;
    } else {
      // ── 並列承認: OR条件の場合、同ステージの残りステップを自動承認 ──
      if (step.stageIndex !== undefined && step.parallelType === 'or') {
        task.approvalRoute = task.approvalRoute.map((s, idx) => {
          if (idx !== stepIndex && s.stageIndex === step.stageIndex && s.status === 'pending') {
            return {
              ...s,
              status: 'approved' as const,
              comment: 'OR条件による自動承認',
              processedAt: new Date().toISOString(),
            };
          }
          return s;
        });
      }

      // ── 現在ステージの完了判定 ──
      const currentStageComplete =
        step.stageIndex === undefined
          ? true
          : task.approvalRoute
              .filter(s => s.stageIndex === step.stageIndex)
              .every(s => s.status === 'approved');

      // 次の pending ステップを探す
      let nextStep: typeof step | undefined;
      if (currentStageComplete) {
        // 次ステージ or stageIndex なしの後続ステップ
        nextStep = task.approvalRoute.find(s => {
          if (s.status !== 'pending') return false;
          if (step.stageIndex === undefined) return true;
          return s.stageIndex === undefined || s.stageIndex > step.stageIndex;
        });
      } else {
        // 同ステージの残り pending（AND並列）
        nextStep = task.approvalRoute.find(
          s => s.stageIndex === step.stageIndex && s.status === 'pending',
        );
      }

      if (!nextStep) {
        task.statusId = 'status_done';
        task.status = 'completed';
        task.currentApproverId = undefined;
        task.currentApproverName = undefined;
      } else {
        task.statusId = 'status_working';
        task.status = 'in_progress';
        task.currentApproverId = nextStep.userId;
        task.currentApproverName = nextStep.userName;
      }
    }

    const updatedTask = await this.updateTask(taskId, task);

    const actionLabel = auditAction === 'approve' ? '承認されました。' : auditAction === 'reject' ? '差し戻されました。' : '回覧確認されました。';
    this.auditLogs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      taskId,
      userId,
      userName: this.users.find(u => u.id === userId)?.name || 'Unknown',
      action: auditAction,
      comment: comment || actionLabel,
      timestamp: new Date().toISOString(),
    });

    this.saveToStorage();
    return updatedTask;
  }

  async addComment(taskId: string, userId: string, comment: string): Promise<void> {
    this.auditLogs.push({
      id: `log_${Date.now()}`,
      taskId,
      userId,
      action: 'comment',
      comment,
      timestamp: new Date().toISOString()
    });
    this.saveToStorage();
  }

  async getUsers(): Promise<User[]> {
    return this.users;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.find(u => u.id === id) || null;
  }

  async getDepartments(): Promise<Department[]> {
    return this.departments;
  }

  async getOrganizationUnits(): Promise<OrganizationUnit[]> {
    return this.orgUnits;
  }

  async getCategories(): Promise<Category[]> {
    return this.categories;
  }

  async getStatuses(): Promise<Status[]> {
    return this.statuses;
  }

  async getCurrentUser(): Promise<User | null> {
    return this.currentUser;
  }

  async getAuditLogs(taskId: string): Promise<AuditLog[]> {
    return this.auditLogs
      .filter(log => log.taskId === taskId)
      .map(log => ({
        ...log,
        userName: log.userName || this.users.find(u => u.id === log.userId)?.name || 'Unknown'
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async getAllAuditLogs(): Promise<AuditLog[]> {
    return this.auditLogs
      .map(log => ({
        ...log,
        userName: log.userName || this.users.find(u => u.id === log.userId)?.name || 'Unknown'
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Descending for full log
  }

  async getManagerHierarchy(userId: string): Promise<User[]> {
    const hierarchy: User[] = [];
    let currentId: string | null = userId;
    
    for (let i = 0; i < 5; i++) { // Limit to 5 levels
      const user = this.users.find(u => u.id === currentId);
      if (!user || !user.managerId) break;
      const manager = this.users.find(u => u.id === user.managerId);
      if (!manager) break;
      hierarchy.push(manager);
      currentId = manager.id;
    }
    
    return hierarchy;
  }

  // --- Organizational Lifecycle Logic ---

  async getUserChangeEvents(): Promise<UserChangeEvent[]> {
    return this.userChangeEvents;
  }

  async scheduleUserChange(event: Omit<UserChangeEvent, 'id' | 'status'>): Promise<UserChangeEvent> {
    const newEvent: UserChangeEvent = {
      ...event,
      id: `evt_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending'
    };
    this.userChangeEvents.push(newEvent);
    this.saveToStorage();
    return newEvent;
  }

  async applyUserChange(eventId: string): Promise<void> {
    const event = this.userChangeEvents.find(e => e.id === eventId);
    if (!event || event.status !== 'pending') return;

    if (event.targetType === 'user') {
      const user = this.users.find(u => u.id === event.targetId);
      if (user) {
        const oldManagerId = user.managerId;
        
        // Apply changes to user profile
        Object.assign(user, event.changes);
        
        // If user retired, left, or moved, reassign THEIR pending tasks to their (new) manager
        if (event.eventType === 'retire' || event.eventType === 'leave' || event.eventType === 'transfer') {
          const reassignToId = user.managerId || oldManagerId;
          if (reassignToId && reassignToId !== user.id) {
            await this.reassignTasks(user.id, reassignToId);
          }
        }
      }
    }

    event.status = 'applied';
    event.appliedAt = new Date().toISOString();
    this.saveToStorage();
  }

  async reassignTasks(oldUserId: string, newUserId: string): Promise<void> {
    this.tasks = this.tasks.map(task => {
      const hasOldUser = task.approvalRoute.some(s => s.userId === oldUserId && s.status === 'pending');
      if (hasOldUser) {
        const newRoute = task.approvalRoute.map(step => {
          if (step.userId === oldUserId && step.status === 'pending') {
            const newUser = this.users.find(u => u.id === newUserId);
            return {
              ...step,
              userId: newUserId,
              userName: newUser?.name || step.userName,
              position: newUser?.position || step.position,
              avatar: newUser?.avatar || step.avatar,
              comment: `Reassigned from ${step.userName} due to org change.`
            };
          }
          return step;
        });
        const oldUser = this.users.find(u => u.id === oldUserId);
        const newUser = this.users.find(u => u.id === newUserId);
        
        // Add Audit Log for reassignment
        this.auditLogs.push({
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          taskId: task.id,
          userId: 'system',
          userName: 'System (Org Change)',
          action: 'reassign',
          comment: `${oldUser?.name || oldUserId} から ${newUser?.name || newUserId} へ担当が引き継がれました（組織変更に伴う自動付替）。`,
          timestamp: new Date().toISOString()
        });

        return {
          ...task,
          approvalRoute: newRoute,
          currentApproverId: newRoute.find(s => s.status === 'pending')?.userId,
          currentApproverName: newRoute.find(s => s.status === 'pending')?.userName
        };
      }
      return task;
    });
    this.saveToStorage();
  }

  async importBulkData(type: 'units' | 'users', csvContent: string): Promise<{ count: number; errors: string[] }> {
    const lines = csvContent.split('\n');
    if (lines.length < 2) return { count: 0, errors: ['CSV content is empty or invalid header'] };

    const header = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1);
    let count = 0;
    const errors: string[] = [];

    if (type === 'users') {
      dataRows.forEach((line, index) => {
        if (!line.trim()) return;
        const values = line.split(',').map(v => v.trim());
        const row: Record<string, string> = {};
        header.forEach((h, i) => row[h] = values[i] || '');

        if (!row.id || !row.email) {
          errors.push(`Line ${index + 2}: Missing ID or Email`);
          return;
        }

        const existing = this.users.find(u => u.id === row.id);
        if (existing) {
          // Update mapping
          if (row.name) existing.name = row.name;
          if (row.position) existing.position = row.position;
          if (row.orgUnitId) existing.orgUnitId = row.orgUnitId;
          if (row.managerId) existing.managerId = row.managerId || null;
          if (row.status) existing.status = row.status as User['status'];
          count++;
        }
      });
    } else if (type === 'units') {
      // Logic for units...
      count = dataRows.length;
    }

    this.saveToStorage();
    return { count, errors };
  }

  async createUser(data: Omit<User, 'id'>): Promise<User> {
    const newUser: User = {
      ...data,
      id: `user_${Math.random().toString(36).substr(2, 9)}`,
    };
    this.users.push(newUser);
    this.saveToStorage();
    return newUser;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('User not found');
    this.users[idx] = { ...this.users[idx], ...data };
    this.saveToStorage();
    return this.users[idx];
  }

  async createOrganizationUnit(data: Omit<OrganizationUnit, 'id'>): Promise<OrganizationUnit> {
    const newUnit: OrganizationUnit = {
      ...data,
      id: `unit_${Math.random().toString(36).substr(2, 9)}`,
    };
    this.orgUnits.push(newUnit);
    this.saveToStorage();
    return newUnit;
  }

  async updateOrganizationUnit(id: string, data: Partial<OrganizationUnit>): Promise<OrganizationUnit> {
    const idx = this.orgUnits.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('OrganizationUnit not found');
    this.orgUnits[idx] = { ...this.orgUnits[idx], ...data };
    this.saveToStorage();
    return this.orgUnits[idx];
  }

  async archiveOrganizationUnit(id: string): Promise<void> {
    const idx = this.orgUnits.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('OrganizationUnit not found');
    this.orgUnits[idx].status = 'archived';
    this.saveToStorage();
  }

  async createCategory(data: Omit<Category, 'id'>): Promise<Category> {
    const newCat: Category = {
      ...data,
      id: `cat_${Math.random().toString(36).substr(2, 9)}`,
    };
    this.categories.push(newCat);
    this.saveToStorage();
    return newCat;
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category> {
    const idx = this.categories.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Category not found');
    this.categories[idx] = { ...this.categories[idx], ...data };
    this.saveToStorage();
    return this.categories[idx];
  }

  async deleteCategory(id: string): Promise<void> {
    this.categories = this.categories.filter(c => c.id !== id);
    this.saveToStorage();
  }

  async updateApprovalRoute(taskId: string, stepIndex: number, newApproverId: string): Promise<Task> {
    const task = await this.getTaskById(taskId);
    if (!task) throw new Error('Task not found');

    const newApprover = this.users.find(u => u.id === newApproverId);
    if (!newApprover) throw new Error('User not found');

    const oldApprover = task.approvalRoute[stepIndex];
    if (!oldApprover) throw new Error('Step not found');

    task.approvalRoute[stepIndex] = {
      ...task.approvalRoute[stepIndex],
      userId: newApproverId,
      userName: newApprover.name,
      position: newApprover.position,
      avatar: newApprover.avatar,
    };

    // currentApprover を再計算
    const firstPending = task.approvalRoute.find(s => s.status === 'pending');
    task.currentApproverId = firstPending?.userId;
    task.currentApproverName = firstPending?.userName;

    const updatedTask = await this.updateTask(taskId, task);

    this.auditLogs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      taskId,
      userId: 'system',
      userName: 'System',
      action: 'reassign',
      comment: `承認者がステップ${stepIndex + 1}で ${oldApprover.userName} から ${newApprover.name} に変更されました。`,
      timestamp: new Date().toISOString()
    });

    this.saveToStorage();
    return updatedTask;
  }

  // ── 代決（代理承認） CRUD ────────────────────────────────────────────
  async getDelegations(): Promise<Delegation[]> {
    return this.delegations;
  }

  async createDelegation(data: Omit<Delegation, 'id'>): Promise<Delegation> {
    const delegation: Delegation = {
      ...data,
      id: `del_${Math.random().toString(36).substr(2, 9)}`,
    };
    this.delegations.push(delegation);
    this.saveToStorage();
    return delegation;
  }

  async revokeDelegation(id: string): Promise<void> {
    const idx = this.delegations.findIndex(d => d.id === id);
    if (idx !== -1) {
      this.delegations[idx].isActive = false;
      this.saveToStorage();
    }
  }
}

export const mockProvider = new MockDataProvider();
