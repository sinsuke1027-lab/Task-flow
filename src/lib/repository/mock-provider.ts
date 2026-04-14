import { DataProvider, Task, User, Department, Status, OrganizationUnit, Category, AuditLog, ApprovalStep, UserChangeEvent } from './types';
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
  private currentUser: User;

  constructor() {
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
  }

  public setCurrentUser(userId: string): void {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      this.currentUser = user;
    }
  }

  private enrichTask(task: Record<string, unknown>): Task {
    const categoryId = task.categoryId as string;
    const statusId = task.statusId as string;
    const category = this.categories.find(c => c.id === categoryId);
    const status = this.statuses.find(s => s.id === statusId);
    
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
        processedAt: step.processedAt as string
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
      status: (status?.label === '完了' ? 'completed' : status?.label === '対応中' ? 'in_progress' : 'todo') as Task['status'],
      approvalRoute: enrichedRoute,
      ccRoute: enrichedCcRoute,
      currentApproverId: enrichedRoute.find(s => s.status === 'pending')?.userId,
      currentApproverName: enrichedRoute.find(s => s.status === 'pending')?.userName,
      customData: task.customData as Record<string, string | number>
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
    const newTask: Task = {
      ...task,
      id: `task_${Math.random().toString(36).substr(2, 9)}`,
      statusId: 'status_todo',
      status: 'todo',
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      dueDate: dueDate.toISOString(),
      approvalRoute: approvalRoute.map(s => ({ ...s, status: 'pending' })),
      ccRoute: ccRoute
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

    return newTask;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Task not found');
    
    this.tasks[index] = { ...this.tasks[index], ...updates, updatedAt: new Date().toISOString() };
    return this.tasks[index];
  }

  async processApproval(taskId: string, userId: string, action: 'approve' | 'reject', comment?: string): Promise<Task> {
    const task = await this.getTaskById(taskId);
    if (!task) throw new Error('Task not found');

    const stepIndex = task.approvalRoute.findIndex(s => s.userId === userId && s.status === 'pending');
    if (stepIndex === -1) throw new Error('No pending approval for this user');

    task.approvalRoute[stepIndex] = {
      ...task.approvalRoute[stepIndex],
      status: action === 'approve' ? 'approved' : 'rejected',
      comment,
      processedAt: new Date().toISOString()
    };

    if (action === 'reject') {
      task.statusId = 'status_rejected';
      task.status = 'todo'; // Simplified
    } else {
      const nextStep = task.approvalRoute.find(s => s.status === 'pending');
      if (!nextStep) {
        task.statusId = 'status_completed';
        task.status = 'completed';
      } else {
        task.status = 'in_progress';
      }
    }

    const updatedTask = await this.updateTask(taskId, task);

    // Add Audit Log
    this.auditLogs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      taskId: taskId,
      userId: userId,
      userName: this.users.find(u => u.id === userId)?.name || 'Unknown',
      action: action,
      comment: comment || (action === 'approve' ? '承認されました。' : '差し戻されました。'),
      timestamp: new Date().toISOString()
    });

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

    return { count, errors };
  }
}

export const mockProvider = new MockDataProvider();
