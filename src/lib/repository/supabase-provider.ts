import { SupabaseClient } from '@supabase/supabase-js';
import {
  DataProvider,
  User,
  Task,
  Category,
  Department,
  OrganizationUnit,
  Status,
  AuditLog,
  UserChangeEvent,
  Delegation,
} from './types';

export class SupabaseDataProvider implements DataProvider {
  constructor(private readonly db: SupabaseClient) {}

  private async tenantId(): Promise<string> {
    const { data: { user }, error } = await this.db.auth.getUser();
    if (error || !user) throw new Error('Not authenticated');
    const tid = user.user_metadata?.tenant_id as string | undefined;
    if (!tid) throw new Error('tenant_id not found in user metadata');
    return tid;
  }

  // ---- Tasks ----

  async getTasks(): Promise<Task[]> {
    const tid = await this.tenantId();
    const { data, error } = await this.db
      .from('tasks')
      .select('*')
      .eq('tenant_id', tid)
      .order('createdAt', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Task[];
  }

  async getTaskById(id: string): Promise<Task | null> {
    const tid = await this.tenantId();
    const { data, error } = await this.db
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tid)
      .single();
    if (error) return null;
    return data as Task;
  }

  async createTask(
    task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'dueDate' | 'statusId' | 'status'>,
  ): Promise<Task> {
    const tid = await this.tenantId();
    const statuses = await this.getStatuses();
    const initialStatus = statuses.find(s => s.label === 'todo') ?? statuses[0];
    const now = new Date().toISOString();
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.db
      .from('tasks')
      .insert({
        ...task,
        tenant_id: tid,
        statusId: initialStatus.id,
        status: 'todo',
        createdAt: now,
        updatedAt: now,
        dueDate,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Task;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const tid = await this.tenantId();
    const { data, error } = await this.db
      .from('tasks')
      .update({ ...updates, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tid)
      .select()
      .single();
    if (error) throw error;
    return data as Task;
  }

  async processApproval(
    taskId: string,
    userId: string,
    action: 'approve' | 'reject' | 'acknowledge',
    comment?: string,
  ): Promise<Task> {
    const task = await this.getTaskById(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const now = new Date().toISOString();
    const route = task.approvalRoute.map(step =>
      step.userId === userId && step.status === 'pending'
        ? {
            ...step,
            status: action === 'reject' ? ('rejected' as const) : ('approved' as const),
            comment,
            processedAt: now,
          }
        : step,
    );

    const statuses = await this.getStatuses();
    let status = task.status;
    let statusId = task.statusId;
    let currentApproverId = task.currentApproverId;
    let currentApproverName = task.currentApproverName;

    if (action === 'reject') {
      const rejectedStatus = statuses.find(s => s.id === 'status_rejected');
      if (rejectedStatus) statusId = rejectedStatus.id;
      status = 'in_progress';
      currentApproverId = undefined;
      currentApproverName = undefined;
    } else {
      const next = route.find(s => s.status === 'pending');
      if (next) {
        currentApproverId = next.userId;
        currentApproverName = next.userName;
      } else {
        const doneStatus = statuses.find(s => s.id === 'status_done');
        if (doneStatus) { status = 'completed'; statusId = doneStatus.id; }
        currentApproverId = undefined;
        currentApproverName = undefined;
      }
    }

    return this.updateTask(taskId, {
      approvalRoute: route,
      status,
      statusId,
      currentApproverId,
      currentApproverName,
    });
  }

  async addComment(taskId: string, userId: string, comment: string): Promise<void> {
    const tid = await this.tenantId();
    const user = await this.getUserById(userId);
    const { error } = await this.db.from('audit_logs').insert({
      tenant_id: tid,
      taskId,
      userId,
      userName: user?.name,
      action: 'comment',
      comment,
      timestamp: new Date().toISOString(),
    });
    if (error) throw error;
  }

  // ---- Users ----

  async getUsers(): Promise<User[]> {
    const tid = await this.tenantId();
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('tenant_id', tid);
    if (error) throw error;
    return (data ?? []) as User[];
  }

  async getUserById(id: string): Promise<User | null> {
    const tid = await this.tenantId();
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tid)
      .single();
    if (error) return null;
    return data as User;
  }

  async getCurrentUser(): Promise<User | null> {
    const { data: { user }, error } = await this.db.auth.getUser();
    if (error || !user?.email) return null;
    const { data } = await this.db
      .from('users')
      .select('*')
      .eq('email', user.email)
      .single();
    return (data ?? null) as User | null;
  }

  async createUser(data: Omit<User, 'id'>): Promise<User> {
    const tid = await this.tenantId();
    const { data: created, error } = await this.db
      .from('users')
      .insert({ ...data, tenant_id: tid })
      .select()
      .single();
    if (error) throw error;
    return created as User;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const tid = await this.tenantId();
    const { data: updated, error } = await this.db
      .from('users')
      .update(data)
      .eq('id', id)
      .eq('tenant_id', tid)
      .select()
      .single();
    if (error) throw error;
    return updated as User;
  }

  async getManagerHierarchy(userId: string): Promise<User[]> {
    const managers: User[] = [];
    let currentId: string | null = userId;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const user = await this.getUserById(currentId);
      if (!user?.managerId) break;
      const manager = await this.getUserById(user.managerId);
      if (!manager) break;
      managers.push(manager);
      currentId = manager.managerId;
    }
    return managers;
  }

  // ---- Departments ----

  async getDepartments(): Promise<Department[]> {
    const tid = await this.tenantId();
    const { data, error } = await this.db
      .from('departments')
      .select('*')
      .eq('tenant_id', tid);
    if (error) throw error;
    return (data ?? []) as Department[];
  }

  // ---- Organization Units ----

  async getOrganizationUnits(): Promise<OrganizationUnit[]> {
    const tid = await this.tenantId();
    const { data, error } = await this.db
      .from('organization_units')
      .select('*')
      .eq('tenant_id', tid);
    if (error) throw error;
    return (data ?? []) as OrganizationUnit[];
  }

  async createOrganizationUnit(data: Omit<OrganizationUnit, 'id'>): Promise<OrganizationUnit> {
    const tid = await this.tenantId();
    const { data: created, error } = await this.db
      .from('organization_units')
      .insert({ ...data, tenant_id: tid })
      .select()
      .single();
    if (error) throw error;
    return created as OrganizationUnit;
  }

  async updateOrganizationUnit(id: string, data: Partial<OrganizationUnit>): Promise<OrganizationUnit> {
    const tid = await this.tenantId();
    const { data: updated, error } = await this.db
      .from('organization_units')
      .update(data)
      .eq('id', id)
      .eq('tenant_id', tid)
      .select()
      .single();
    if (error) throw error;
    return updated as OrganizationUnit;
  }

  async archiveOrganizationUnit(id: string): Promise<void> {
    await this.updateOrganizationUnit(id, { status: 'archived' });
  }

  // ---- Categories ----

  async getCategories(): Promise<Category[]> {
    const tid = await this.tenantId();
    const { data, error } = await this.db
      .from('categories')
      .select('*')
      .eq('tenant_id', tid);
    if (error) throw error;
    return (data ?? []) as Category[];
  }

  async createCategory(data: Omit<Category, 'id'>): Promise<Category> {
    const tid = await this.tenantId();
    const { data: created, error } = await this.db
      .from('categories')
      .insert({ ...data, tenant_id: tid })
      .select()
      .single();
    if (error) throw error;
    return created as Category;
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category> {
    const tid = await this.tenantId();
    const { data: updated, error } = await this.db
      .from('categories')
      .update(data)
      .eq('id', id)
      .eq('tenant_id', tid)
      .select()
      .single();
    if (error) throw error;
    return updated as Category;
  }

  async deleteCategory(id: string): Promise<void> {
    const tid = await this.tenantId();
    const { error } = await this.db
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tid);
    if (error) throw error;
  }

  // ---- Statuses ----

  async getStatuses(): Promise<Status[]> {
    const tid = await this.tenantId();
    const { data, error } = await this.db
      .from('statuses')
      .select('*')
      .eq('tenant_id', tid);
    if (error) throw error;
    return (data ?? []) as Status[];
  }

  // ---- Audit Logs ----

  async getAuditLogs(taskId: string): Promise<AuditLog[]> {
    const tid = await this.tenantId();
    const { data, error } = await this.db
      .from('audit_logs')
      .select('*')
      .eq('taskId', taskId)
      .eq('tenant_id', tid)
      .order('timestamp', { ascending: true });
    if (error) throw error;
    return (data ?? []) as AuditLog[];
  }

  async getAllAuditLogs(): Promise<AuditLog[]> {
    const tid = await this.tenantId();
    const { data, error } = await this.db
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tid)
      .order('timestamp', { ascending: false });
    if (error) throw error;
    return (data ?? []) as AuditLog[];
  }

  // ---- User Change Events ----

  async getUserChangeEvents(): Promise<UserChangeEvent[]> {
    const tid = await this.tenantId();
    const { data, error } = await this.db
      .from('user_change_events')
      .select('*')
      .eq('tenant_id', tid)
      .order('scheduledAt', { ascending: true });
    if (error) throw error;
    return (data ?? []) as UserChangeEvent[];
  }

  async scheduleUserChange(event: Omit<UserChangeEvent, 'id' | 'status'>): Promise<UserChangeEvent> {
    const tid = await this.tenantId();
    const { data, error } = await this.db
      .from('user_change_events')
      .insert({ ...event, tenant_id: tid, status: 'pending' })
      .select()
      .single();
    if (error) throw error;
    return data as UserChangeEvent;
  }

  async applyUserChange(eventId: string): Promise<void> {
    const tid = await this.tenantId();
    const { data: raw, error: fetchErr } = await this.db
      .from('user_change_events')
      .select('*')
      .eq('id', eventId)
      .eq('tenant_id', tid)
      .single();
    if (fetchErr || !raw) throw new Error(`Event ${eventId} not found`);

    const event = raw as UserChangeEvent;
    if (event.targetType === 'user') {
      await this.updateUser(event.targetId, event.changes as Partial<User>);
    } else {
      await this.updateOrganizationUnit(event.targetId, event.changes as Partial<OrganizationUnit>);
    }

    const { error } = await this.db
      .from('user_change_events')
      .update({ status: 'applied', appliedAt: new Date().toISOString() })
      .eq('id', eventId)
      .eq('tenant_id', tid);
    if (error) throw error;
  }

  async reassignTasks(oldUserId: string, newUserId: string): Promise<void> {
    const tid = await this.tenantId();
    const newUser = await this.getUserById(newUserId);
    if (!newUser) throw new Error(`User ${newUserId} not found`);
    const { error } = await this.db
      .from('tasks')
      .update({ currentApproverId: newUserId, currentApproverName: newUser.name })
      .eq('currentApproverId', oldUserId)
      .eq('tenant_id', tid);
    if (error) throw error;
  }

  async importBulkData(
    type: 'units' | 'users',
    csvContent: string,
  ): Promise<{ count: number; errors: string[] }> {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return { count: 0, errors: ['CSV is empty or has no data rows'] };

    const headers = lines[0].split(',').map(h => h.trim());
    const errors: string[] = [];
    let count = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const record = Object.fromEntries(headers.map((h, idx) => [h, values[idx] ?? '']));
      try {
        if (type === 'users') {
          await this.createUser(record as unknown as Omit<User, 'id'>);
        } else {
          await this.createOrganizationUnit(record as unknown as Omit<OrganizationUnit, 'id'>);
        }
        count++;
      } catch (e) {
        errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return { count, errors };
  }

  // ---- Approval Route ----

  async updateApprovalRoute(taskId: string, stepIndex: number, newApproverId: string): Promise<Task> {
    const task = await this.getTaskById(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const newUser = await this.getUserById(newApproverId);
    if (!newUser) throw new Error(`User ${newApproverId} not found`);

    const route = [...task.approvalRoute];
    if (stepIndex < 0 || stepIndex >= route.length) throw new Error('Invalid step index');
    route[stepIndex] = { ...route[stepIndex], userId: newApproverId, userName: newUser.name };

    return this.updateTask(taskId, { approvalRoute: route });
  }

  // ---- Delegations ----

  async getDelegations(): Promise<Delegation[]> {
    const tid = await this.tenantId();
    const { data, error } = await this.db
      .from('delegations')
      .select('*')
      .eq('tenant_id', tid);
    if (error) throw error;
    return (data ?? []) as Delegation[];
  }

  async createDelegation(data: Omit<Delegation, 'id'>): Promise<Delegation> {
    const tid = await this.tenantId();
    const { data: created, error } = await this.db
      .from('delegations')
      .insert({ ...data, tenant_id: tid })
      .select()
      .single();
    if (error) throw error;
    return created as Delegation;
  }

  async revokeDelegation(id: string): Promise<void> {
    const tid = await this.tenantId();
    const { error } = await this.db
      .from('delegations')
      .update({ isActive: false })
      .eq('id', id)
      .eq('tenant_id', tid);
    if (error) throw error;
  }
}
