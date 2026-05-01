import { describe, it, expect } from 'vitest';
import { isMyTurn, resolveWorkflowTemplate, getActiveStageIndex } from './workflow-utils';
import type { Task, User, Delegation, WorkflowStepTemplate, ApprovalStep } from './repository/types';

// --- Factories ---

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    departmentId: 'dept-1',
    orgUnitId: 'org-1',
    managerId: null,
    position: 'Member',
    status: 'active',
    joinedAt: '2024-01-01',
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: '',
    requesterId: 'user-req',
    targetDepartmentId: 'dept-1',
    categoryId: 'cat-1',
    statusId: 'status-pending',
    status: 'in_progress',
    priority: 'normal',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    dueDate: '2024-01-31',
    approvalRoute: [],
    ...overrides,
  };
}

function makeStep(overrides: Partial<ApprovalStep> = {}): ApprovalStep {
  return {
    userId: 'user-1',
    userName: 'Test User',
    status: 'pending',
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<WorkflowStepTemplate> = {}): WorkflowStepTemplate {
  return {
    id: 'tpl-1',
    label: 'Step 1',
    approverType: 'direct_manager',
    stageIndex: 0,
    ...overrides,
  };
}

// --- getActiveStageIndex ---

describe('getActiveStageIndex', () => {
  it('returns the minimum stageIndex of pending steps', () => {
    const task = makeTask({
      approvalRoute: [
        makeStep({ stageIndex: 2, status: 'pending' }),
        makeStep({ stageIndex: 0, status: 'pending' }),
        makeStep({ stageIndex: 1, status: 'approved' }),
      ],
    });
    expect(getActiveStageIndex(task)).toBe(0);
  });

  it('returns undefined when no pending steps have stageIndex', () => {
    const task = makeTask({
      approvalRoute: [
        makeStep({ status: 'approved' }),
        makeStep({ status: 'rejected' }),
      ],
    });
    expect(getActiveStageIndex(task)).toBeUndefined();
  });

  it('returns undefined for empty approvalRoute', () => {
    expect(getActiveStageIndex(makeTask())).toBeUndefined();
  });

  it('ignores non-pending steps when computing minimum', () => {
    const task = makeTask({
      approvalRoute: [
        makeStep({ stageIndex: 0, status: 'approved' }),
        makeStep({ stageIndex: 1, status: 'pending' }),
      ],
    });
    expect(getActiveStageIndex(task)).toBe(1);
  });
});

// --- isMyTurn ---

describe('isMyTurn', () => {
  describe('completed task', () => {
    it('returns false regardless of approvalRoute', () => {
      const task = makeTask({
        status: 'completed',
        currentApproverId: 'user-1',
        approvalRoute: [makeStep({ userId: 'user-1', status: 'pending' })],
      });
      expect(isMyTurn(task, 'user-1')).toBe(false);
    });
  });

  describe('without stageIndex (legacy mode)', () => {
    it('returns true when currentApproverId matches and user has a pending step', () => {
      const task = makeTask({
        currentApproverId: 'user-1',
        approvalRoute: [makeStep({ userId: 'user-1', status: 'pending' })],
      });
      expect(isMyTurn(task, 'user-1')).toBe(true);
    });

    it('returns false when currentApproverId does not match userId', () => {
      const task = makeTask({
        currentApproverId: 'user-2',
        approvalRoute: [makeStep({ userId: 'user-1', status: 'pending' })],
      });
      expect(isMyTurn(task, 'user-1')).toBe(false);
    });

    it('returns false when user has no pending steps', () => {
      const task = makeTask({
        currentApproverId: 'user-1',
        approvalRoute: [makeStep({ userId: 'user-1', status: 'approved' })],
      });
      expect(isMyTurn(task, 'user-1')).toBe(false);
    });

    it('returns true via active delegation when delegator is currentApproverId', () => {
      const task = makeTask({
        currentApproverId: 'user-delegator',
        approvalRoute: [makeStep({ userId: 'user-delegator', status: 'pending' })],
      });
      const delegation: Delegation = {
        id: 'del-1',
        delegatorId: 'user-delegator',
        delegateId: 'user-1',
        startDate: '2024-01-01',
        isActive: true,
      };
      expect(isMyTurn(task, 'user-1', [delegation])).toBe(true);
    });

    it('returns false when delegation is inactive', () => {
      const task = makeTask({
        currentApproverId: 'user-delegator',
        approvalRoute: [makeStep({ userId: 'user-delegator', status: 'pending' })],
      });
      const delegation: Delegation = {
        id: 'del-1',
        delegatorId: 'user-delegator',
        delegateId: 'user-1',
        startDate: '2024-01-01',
        isActive: false,
      };
      expect(isMyTurn(task, 'user-1', [delegation])).toBe(false);
    });
  });

  describe('with stageIndex', () => {
    it('returns true when user has pending step at active stage', () => {
      const task = makeTask({
        approvalRoute: [
          makeStep({ userId: 'user-1', stageIndex: 0, status: 'pending' }),
          makeStep({ userId: 'user-2', stageIndex: 1, status: 'pending' }),
        ],
      });
      expect(isMyTurn(task, 'user-1')).toBe(true);
    });

    it('returns false when user pending step is at non-active stage', () => {
      const task = makeTask({
        approvalRoute: [
          makeStep({ userId: 'user-2', stageIndex: 0, status: 'pending' }),
          makeStep({ userId: 'user-1', stageIndex: 1, status: 'pending' }),
        ],
      });
      // activeStage is 0 (minimum), user-1 is at stage 1
      expect(isMyTurn(task, 'user-1')).toBe(false);
    });

    it('returns false when all steps are approved (no active stage)', () => {
      const task = makeTask({
        approvalRoute: [
          makeStep({ userId: 'user-1', stageIndex: 0, status: 'approved' }),
        ],
      });
      expect(isMyTurn(task, 'user-1')).toBe(false);
    });

    it('returns true via delegation at active stage', () => {
      const task = makeTask({
        approvalRoute: [
          makeStep({ userId: 'user-delegator', stageIndex: 0, status: 'pending' }),
        ],
      });
      const delegation: Delegation = {
        id: 'del-1',
        delegatorId: 'user-delegator',
        delegateId: 'user-1',
        startDate: '2024-01-01',
        isActive: true,
      };
      expect(isMyTurn(task, 'user-1', [delegation])).toBe(true);
    });

    it('returns false when delegator step is at non-active stage', () => {
      const task = makeTask({
        approvalRoute: [
          makeStep({ userId: 'user-2', stageIndex: 0, status: 'pending' }),
          makeStep({ userId: 'user-delegator', stageIndex: 1, status: 'pending' }),
        ],
      });
      const delegation: Delegation = {
        id: 'del-1',
        delegatorId: 'user-delegator',
        delegateId: 'user-1',
        startDate: '2024-01-01',
        isActive: true,
      };
      expect(isMyTurn(task, 'user-1', [delegation])).toBe(false);
    });

    it('handles single-step route correctly', () => {
      const task = makeTask({
        approvalRoute: [makeStep({ userId: 'user-1', stageIndex: 0, status: 'pending' })],
      });
      expect(isMyTurn(task, 'user-1')).toBe(true);
      expect(isMyTurn(task, 'user-other')).toBe(false);
    });

    it('handles multiple parallel steps at same stage (or)', () => {
      const task = makeTask({
        approvalRoute: [
          makeStep({ userId: 'user-1', stageIndex: 0, status: 'pending', parallelType: 'or' }),
          makeStep({ userId: 'user-2', stageIndex: 0, status: 'pending', parallelType: 'or' }),
        ],
      });
      expect(isMyTurn(task, 'user-1')).toBe(true);
      expect(isMyTurn(task, 'user-2')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('returns false for empty approvalRoute', () => {
      const task = makeTask({ approvalRoute: [] });
      expect(isMyTurn(task, 'user-1')).toBe(false);
    });

    it('ignores empty delegations array', () => {
      const task = makeTask({
        currentApproverId: 'user-1',
        approvalRoute: [makeStep({ userId: 'user-1', status: 'pending' })],
      });
      expect(isMyTurn(task, 'user-1', [])).toBe(true);
    });
  });
});

// --- resolveWorkflowTemplate ---

describe('resolveWorkflowTemplate', () => {
  const member = makeUser({ id: 'user-member', name: 'Member', managerId: 'user-mgr', role: 'user' });
  const manager = makeUser({ id: 'user-mgr', name: 'Manager', managerId: 'user-gm', role: 'user', position: 'GM' });
  const grandManager = makeUser({ id: 'user-gm', name: 'Grand Manager', managerId: 'user-vp', role: 'user', position: 'Division Manager' });
  const vp = makeUser({ id: 'user-vp', name: 'VP', managerId: null, role: 'user', position: 'President' });
  const adminA = makeUser({ id: 'admin-a', name: 'Admin A', role: 'admin', status: 'active' });
  const adminB = makeUser({ id: 'admin-b', name: 'Admin B', role: 'admin', status: 'active' });
  const inactiveAdmin = makeUser({ id: 'admin-inactive', name: 'Inactive Admin', role: 'admin', status: 'inactive' });

  const allUsers = [member, manager, grandManager, vp, adminA, adminB, inactiveAdmin];

  describe('empty template', () => {
    it('returns empty array', () => {
      expect(resolveWorkflowTemplate([], member, allUsers)).toEqual([]);
    });
  });

  describe('direct_manager', () => {
    it('resolves to direct manager', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'direct_manager', stageIndex: 0 })],
        member,
        allUsers,
      );
      expect(steps).toHaveLength(1);
      expect(steps[0].userId).toBe('user-mgr');
      expect(steps[0].userName).toBe('Manager');
      expect(steps[0].status).toBe('pending');
      expect(steps[0].stageIndex).toBe(0);
    });

    it('returns empty userId when no manager is set', () => {
      // vp has managerId: null → no direct manager
      const stepsForVp = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'direct_manager' })],
        vp,
        allUsers,
      );
      expect(stepsForVp[0].userId).toBe('');
      expect(stepsForVp[0].userName).toBe('（上長未設定）');
    });
  });

  describe('second_manager', () => {
    it('resolves to manager of manager', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'second_manager', stageIndex: 1 })],
        member,
        allUsers,
      );
      expect(steps).toHaveLength(1);
      expect(steps[0].userId).toBe('user-gm');
      expect(steps[0].userName).toBe('Grand Manager');
    });

    it('returns fallback when second manager does not exist', () => {
      // manager's managerId is 'user-gm', gm's managerId is 'user-vp'
      // For grandManager: managerId='user-vp', vp has no manager → second_manager = null
      const stepsForGm = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'second_manager' })],
        grandManager,
        allUsers,
      );
      expect(stepsForGm[0].userId).toBe('');
      expect(stepsForGm[0].userName).toBe('（2段階上長未設定）');
    });
  });

  describe('third_manager', () => {
    it('resolves to three levels up', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'third_manager', stageIndex: 2 })],
        member,
        allUsers,
      );
      expect(steps).toHaveLength(1);
      expect(steps[0].userId).toBe('user-vp');
      expect(steps[0].userName).toBe('VP');
    });

    it('returns fallback when third manager does not exist', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'third_manager' })],
        manager,
        allUsers,
      );
      // manager → gm → vp → null (vp has no managerId)
      expect(steps[0].userId).toBe('');
      expect(steps[0].userName).toBe('（3段階上長未設定）');
    });
  });

  describe('specific_user', () => {
    it('resolves to specified user', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'specific_user', approverUserId: 'user-mgr', stageIndex: 0 })],
        member,
        allUsers,
      );
      expect(steps).toHaveLength(1);
      expect(steps[0].userId).toBe('user-mgr');
      expect(steps[0].userName).toBe('Manager');
    });

    it('returns fallback when specified user does not exist', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'specific_user', approverUserId: 'nonexistent' })],
        member,
        allUsers,
      );
      expect(steps[0].userId).toBe('');
      expect(steps[0].userName).toBe('（ユーザー未設定）');
    });
  });

  describe('role', () => {
    it('returns fallback when no active admin users exist', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'role', approverRole: 'HR_Admin' })],
        member,
        [member, manager], // no admins
      );
      expect(steps).toHaveLength(1);
      expect(steps[0].userId).toBe('');
      expect(steps[0].userName).toContain('未設定');
    });

    it('uses role label from ROLE_LABEL map', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'role', approverRole: 'HR_Admin' })],
        member,
        [member, manager],
      );
      expect(steps[0].userName).toContain('人事担当');
    });

    it('falls back to raw role string for unknown roles', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'role', approverRole: 'Unknown_Role' })],
        member,
        [member, manager],
      );
      expect(steps[0].userName).toContain('Unknown_Role');
    });

    it('creates single step when exactly one active admin exists', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'role', stageIndex: 0 })],
        member,
        [member, adminA, inactiveAdmin],
      );
      expect(steps).toHaveLength(1);
      expect(steps[0].userId).toBe('admin-a');
    });

    it('creates one step per active admin with parallelType or when multiple exist', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'role', stageIndex: 0 })],
        member,
        [member, adminA, adminB, inactiveAdmin],
      );
      expect(steps).toHaveLength(2);
      expect(steps.every(s => s.parallelType === 'or')).toBe(true);
      expect(steps.map(s => s.userId).sort()).toEqual(['admin-a', 'admin-b'].sort());
    });

    it('excludes inactive admins from role resolution', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'role', stageIndex: 0 })],
        member,
        [member, inactiveAdmin],
      );
      expect(steps[0].userId).toBe('');
    });
  });

  describe('approval_group', () => {
    it('returns fallback when group is empty', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'approval_group', approverGroupIds: [] })],
        member,
        allUsers,
      );
      expect(steps).toHaveLength(1);
      expect(steps[0].userId).toBe('');
      expect(steps[0].userName).toBe('（グループ未設定）');
    });

    it('returns fallback when all group IDs are unknown', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'approval_group', approverGroupIds: ['nonexistent-1', 'nonexistent-2'] })],
        member,
        allUsers,
      );
      expect(steps).toHaveLength(1);
      expect(steps[0].userId).toBe('');
    });

    it('creates one step per group member', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'approval_group', approverGroupIds: ['user-mgr', 'user-gm'], parallelType: 'and' })],
        member,
        allUsers,
      );
      expect(steps).toHaveLength(2);
      expect(steps.map(s => s.userId).sort()).toEqual(['user-mgr', 'user-gm'].sort());
    });

    it('inherits parallelType from template', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'approval_group', approverGroupIds: ['user-mgr', 'user-gm'], parallelType: 'and' })],
        member,
        allUsers,
      );
      expect(steps.every(s => s.parallelType === 'and')).toBe(true);
    });

    it('defaults parallelType to or when not specified', () => {
      const steps = resolveWorkflowTemplate(
        [makeTemplate({ approverType: 'approval_group', approverGroupIds: ['user-mgr', 'user-gm'] })],
        member,
        allUsers,
      );
      expect(steps.every(s => s.parallelType === 'or')).toBe(true);
    });
  });

  describe('multi-step template', () => {
    it('processes steps in order and assigns correct stageIndex', () => {
      const template: WorkflowStepTemplate[] = [
        makeTemplate({ id: 'tpl-1', approverType: 'direct_manager', stageIndex: 0 }),
        makeTemplate({ id: 'tpl-2', approverType: 'specific_user', approverUserId: 'user-gm', stageIndex: 1 }),
      ];
      const steps = resolveWorkflowTemplate(template, member, allUsers);
      expect(steps).toHaveLength(2);
      expect(steps[0].stageIndex).toBe(0);
      expect(steps[0].userId).toBe('user-mgr');
      expect(steps[1].stageIndex).toBe(1);
      expect(steps[1].userId).toBe('user-gm');
    });

    it('all resolved steps have status pending', () => {
      const template: WorkflowStepTemplate[] = [
        makeTemplate({ approverType: 'direct_manager', stageIndex: 0 }),
        makeTemplate({ id: 'tpl-2', approverType: 'second_manager', stageIndex: 1 }),
      ];
      const steps = resolveWorkflowTemplate(template, member, allUsers);
      expect(steps.every(s => s.status === 'pending')).toBe(true);
    });
  });
});
