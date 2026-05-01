import { describe, it, expect, beforeEach } from 'vitest';
import { MockDataProvider } from './mock-provider';
import type { ApprovalStep } from './types';

// --- Factories ---

function makeStep(overrides: Partial<ApprovalStep> = {}): ApprovalStep {
  return {
    userId: 'approver-1',
    userName: 'Approver One',
    status: 'pending',
    ...overrides,
  };
}

type TaskInput = Parameters<MockDataProvider['createTask']>[0];

function makeTaskInput(overrides: Partial<TaskInput> = {}): TaskInput {
  return {
    title: 'Test Task',
    description: 'Test description',
    requesterId: 'user-req',
    targetDepartmentId: 'dept-1',
    categoryId: 'cat-nonexistent', // unknown category → uses default slaDays=5
    priority: 'normal',
    approvalRoute: [makeStep()],
    ...overrides,
  };
}

// --- Tests ---

describe('MockDataProvider', () => {
  let provider: MockDataProvider;

  beforeEach(() => {
    localStorage.clear();
    provider = new MockDataProvider();
  });

  // =====================================================================
  // createTask
  // =====================================================================

  describe('createTask', () => {
    it('creates a task and returns it with status todo', async () => {
      const task = await provider.createTask(makeTaskInput());
      expect(task.status).toBe('todo');
      expect(task.statusId).toBe('status_todo');
    });

    it('assigns a unique id with task_ prefix', async () => {
      const task = await provider.createTask(makeTaskInput());
      expect(task.id).toMatch(/^task_/);
    });

    it('generates distinct ids for separate tasks', async () => {
      const t1 = await provider.createTask(makeTaskInput());
      const t2 = await provider.createTask(makeTaskInput());
      expect(t1.id).not.toBe(t2.id);
    });

    it('sets all approval route steps to pending regardless of input status', async () => {
      const task = await provider.createTask(
        makeTaskInput({
          approvalRoute: [makeStep({ status: 'approved' }), makeStep({ userId: 'approver-2', userName: 'Approver Two', status: 'rejected' })],
        }),
      );
      expect(task.approvalRoute.every(s => s.status === 'pending')).toBe(true);
    });

    it('sets currentApproverId and currentApproverName to the first approver', async () => {
      const task = await provider.createTask(
        makeTaskInput({
          approvalRoute: [
            makeStep({ userId: 'approver-1', userName: 'First' }),
            makeStep({ userId: 'approver-2', userName: 'Second' }),
          ],
        }),
      );
      expect(task.currentApproverId).toBe('approver-1');
      expect(task.currentApproverName).toBe('First');
    });

    it('sets currentApproverId to undefined when approval route is empty', async () => {
      const task = await provider.createTask(makeTaskInput({ approvalRoute: [] }));
      expect(task.currentApproverId).toBeUndefined();
    });

    it('records an audit log entry with action submit', async () => {
      const task = await provider.createTask(makeTaskInput());
      const logs = await provider.getAuditLogs(task.id);
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('submit');
      expect(logs[0].taskId).toBe(task.id);
      expect(logs[0].userId).toBe('user-req');
    });

    it('appends the new task to the task list', async () => {
      const before = (await provider.getTasks()).length;
      await provider.createTask(makeTaskInput());
      const after = (await provider.getTasks()).length;
      expect(after).toBe(before + 1);
    });

    it('makes the task retrievable by getTaskById', async () => {
      const created = await provider.createTask(makeTaskInput({ title: 'Retrieve me' }));
      const found = await provider.getTaskById(created.id);
      expect(found).not.toBeNull();
      expect(found?.title).toBe('Retrieve me');
    });
  });

  // =====================================================================
  // processApproval
  // =====================================================================

  describe('processApproval', () => {
    const twoStepInput = makeTaskInput({
      approvalRoute: [
        makeStep({ userId: 'approver-1', userName: 'First' }),
        makeStep({ userId: 'approver-2', userName: 'Second' }),
      ],
    });

    // --- approve ---

    describe('approve action', () => {
      it('transitions to in_progress after first approval in a multi-step route', async () => {
        const task = await provider.createTask(twoStepInput);
        const updated = await provider.processApproval(task.id, 'approver-1', 'approve');

        expect(updated.status).toBe('in_progress');
        expect(updated.statusId).toBe('status_working');
        expect(updated.currentApproverId).toBe('approver-2');
        expect(updated.currentApproverName).toBe('Second');
      });

      it('marks the approved step as approved with timestamp', async () => {
        const task = await provider.createTask(twoStepInput);
        const updated = await provider.processApproval(task.id, 'approver-1', 'approve', 'LGTM');

        expect(updated.approvalRoute[0].status).toBe('approved');
        expect(updated.approvalRoute[0].comment).toBe('LGTM');
        expect(updated.approvalRoute[0].processedAt).toBeTruthy();
      });

      it('transitions to completed after all steps are approved', async () => {
        const task = await provider.createTask(twoStepInput);
        await provider.processApproval(task.id, 'approver-1', 'approve');
        const final = await provider.processApproval(task.id, 'approver-2', 'approve');

        expect(final.status).toBe('completed');
        expect(final.statusId).toBe('status_done');
        expect(final.currentApproverId).toBeUndefined();
        expect(final.currentApproverName).toBeUndefined();
      });

      it('transitions directly to completed for a single-step route', async () => {
        const task = await provider.createTask(makeTaskInput({
          approvalRoute: [makeStep({ userId: 'approver-1', userName: 'Only' })],
        }));
        const updated = await provider.processApproval(task.id, 'approver-1', 'approve');

        expect(updated.status).toBe('completed');
        expect(updated.statusId).toBe('status_done');
      });

      it('creates an audit log entry for approve', async () => {
        const task = await provider.createTask(twoStepInput);
        await provider.processApproval(task.id, 'approver-1', 'approve');

        const logs = await provider.getAuditLogs(task.id);
        const approveLog = logs.find(l => l.action === 'approve');
        expect(approveLog).toBeDefined();
        expect(approveLog?.userId).toBe('approver-1');
      });
    });

    // --- reject ---

    describe('reject action', () => {
      it('sets status to todo and statusId to status_rejected', async () => {
        const task = await provider.createTask(twoStepInput);
        const updated = await provider.processApproval(task.id, 'approver-1', 'reject', 'NG');

        expect(updated.status).toBe('todo');
        expect(updated.statusId).toBe('status_rejected');
      });

      it('clears currentApproverId and currentApproverName on rejection', async () => {
        const task = await provider.createTask(twoStepInput);
        const updated = await provider.processApproval(task.id, 'approver-1', 'reject');

        expect(updated.currentApproverId).toBeUndefined();
        expect(updated.currentApproverName).toBeUndefined();
      });

      it('marks the rejected step with status rejected and records comment', async () => {
        const task = await provider.createTask(twoStepInput);
        const updated = await provider.processApproval(task.id, 'approver-1', 'reject', 'Not acceptable');

        expect(updated.approvalRoute[0].status).toBe('rejected');
        expect(updated.approvalRoute[0].comment).toBe('Not acceptable');
        expect(updated.approvalRoute[0].processedAt).toBeTruthy();
      });

      it('leaves subsequent pending steps untouched after rejection', async () => {
        const task = await provider.createTask(twoStepInput);
        const updated = await provider.processApproval(task.id, 'approver-1', 'reject');

        expect(updated.approvalRoute[1].status).toBe('pending');
      });

      it('creates an audit log entry for reject', async () => {
        const task = await provider.createTask(twoStepInput);
        await provider.processApproval(task.id, 'approver-1', 'reject', 'Rejected!');

        const logs = await provider.getAuditLogs(task.id);
        const rejectLog = logs.find(l => l.action === 'reject');
        expect(rejectLog).toBeDefined();
        expect(rejectLog?.comment).toBe('Rejected!');
      });
    });

    // --- acknowledge (circulation) ---

    describe('acknowledge action', () => {
      it('treats acknowledge as approved and completes a single-step task', async () => {
        const task = await provider.createTask(
          makeTaskInput({
            taskType: 'circulation',
            approvalRoute: [makeStep({ userId: 'approver-1', userName: 'Reviewer' })],
          }),
        );
        const updated = await provider.processApproval(task.id, 'approver-1', 'acknowledge');

        expect(updated.approvalRoute[0].status).toBe('approved');
        expect(updated.status).toBe('completed');
      });

      it('creates an audit log entry with action acknowledge', async () => {
        const task = await provider.createTask(
          makeTaskInput({
            taskType: 'circulation',
            approvalRoute: [makeStep({ userId: 'approver-1', userName: 'Reviewer' })],
          }),
        );
        await provider.processApproval(task.id, 'approver-1', 'acknowledge');

        const logs = await provider.getAuditLogs(task.id);
        expect(logs.some(l => l.action === 'acknowledge')).toBe(true);
      });
    });

    // --- parallel OR approval ---

    describe('parallel OR approval', () => {
      const parallelInput = makeTaskInput({
        approvalRoute: [
          makeStep({ userId: 'approver-a', userName: 'A', stageIndex: 0, parallelType: 'or' }),
          makeStep({ userId: 'approver-b', userName: 'B', stageIndex: 0, parallelType: 'or' }),
        ],
      });

      it('auto-approves remaining OR-group steps when one approves', async () => {
        const task = await provider.createTask(parallelInput);
        const updated = await provider.processApproval(task.id, 'approver-a', 'approve');

        expect(updated.approvalRoute[0].status).toBe('approved');
        expect(updated.approvalRoute[1].status).toBe('approved');
      });

      it('completes the task after OR-group auto-approval (no subsequent steps)', async () => {
        const task = await provider.createTask(parallelInput);
        const updated = await provider.processApproval(task.id, 'approver-a', 'approve');

        expect(updated.status).toBe('completed');
      });
    });

    // --- error handling ---

    describe('error handling', () => {
      it('throws when the task is not found', async () => {
        await expect(
          provider.processApproval('nonexistent-task-id', 'approver-1', 'approve'),
        ).rejects.toThrow('Task not found');
      });

      it('throws when the user has no pending approval step', async () => {
        const task = await provider.createTask(twoStepInput);
        await expect(
          provider.processApproval(task.id, 'wrong-user', 'approve'),
        ).rejects.toThrow('No pending approval for this user');
      });

      it('throws when the user already processed their step', async () => {
        const task = await provider.createTask(twoStepInput);
        await provider.processApproval(task.id, 'approver-1', 'approve');
        await expect(
          provider.processApproval(task.id, 'approver-1', 'approve'),
        ).rejects.toThrow('No pending approval for this user');
      });

      it('throws when a completed task is approved again', async () => {
        const task = await provider.createTask(makeTaskInput({
          approvalRoute: [makeStep({ userId: 'approver-1', userName: 'Only' })],
        }));
        await provider.processApproval(task.id, 'approver-1', 'approve');
        await expect(
          provider.processApproval(task.id, 'approver-1', 'approve'),
        ).rejects.toThrow('No pending approval for this user');
      });
    });
  });
});
