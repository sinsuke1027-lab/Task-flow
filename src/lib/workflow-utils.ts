import { Task, Delegation, WorkflowStepTemplate, ApprovalStep, User } from './repository/types';

/**
 * 現在のアクティブステージ（最小の stageIndex）を返す。
 * stageIndex が設定されていない場合は undefined。
 */
export function getActiveStageIndex(task: Task): number | undefined {
  const stages = task.approvalRoute
    .filter(s => s.status === 'pending' && s.stageIndex !== undefined)
    .map(s => s.stageIndex as number);
  if (stages.length === 0) return undefined;
  return Math.min(...stages);
}

/**
 * 指定ユーザーが今すぐアクションを取るべきタスクかを判定する。
 * 代決（Delegation）も考慮する。
 */
export function isMyTurn(
  task: Task,
  userId: string,
  delegations: Delegation[] = [],
): boolean {
  if (task.status === 'completed') return false;

  // 自分自身が pending のステップを持つか確認
  const myPendingSteps = task.approvalRoute.filter(
    s => s.userId === userId && s.status === 'pending',
  );

  // 代決: 自分が delegate になっている delegator が pending か確認
  const delegatedSteps = delegations
    .filter(d => d.delegateId === userId && d.isActive)
    .flatMap(d =>
      task.approvalRoute.filter(s => s.userId === d.delegatorId && s.status === 'pending'),
    );

  const allRelevantSteps = [...myPendingSteps, ...delegatedSteps];
  if (allRelevantSteps.length === 0) return false;

  // stageIndex が存在しない場合: 従来の currentApproverId チェック
  const hasStageInfo = task.approvalRoute.some(s => s.stageIndex !== undefined);
  if (!hasStageInfo) {
    return task.currentApproverId === userId ||
      delegations.some(d => d.delegateId === userId && d.isActive && d.delegatorId === task.currentApproverId);
  }

  // stageIndex がある場合: 現在のアクティブステージに自分のステップがあるか
  const activeStage = getActiveStageIndex(task);
  if (activeStage === undefined) return false;

  return allRelevantSteps.some(s => s.stageIndex === activeStage);
}

/** 組織階層を辿って N 段上の上長を返す（0 = 直属上長）*/
function resolveManagerByLevel(userId: string, allUsers: User[], level: number): User | null {
  let current = allUsers.find(u => u.id === userId);
  for (let i = 0; i <= level; i++) {
    if (!current?.managerId) return null;
    const manager = allUsers.find(u => u.id === current!.managerId);
    if (!manager) return null;
    if (i === level) return manager;
    current = manager;
  }
  return null;
}

const ROLE_LABEL: Record<string, string> = {
  HR_Admin: '人事担当',
  IT_Admin: 'IT担当',
  GA_Admin: '総務担当',
};

/**
 * WorkflowStepTemplate[] を ApprovalStep[] に解決する。
 * 解決できなかったステップは userId/userName が空文字になる（手動選択を促す）。
 */
export function resolveWorkflowTemplate(
  template: WorkflowStepTemplate[],
  currentUser: User,
  allUsers: User[],
): ApprovalStep[] {
  const steps: ApprovalStep[] = [];

  for (const tpl of template) {
    const base = {
      status: 'pending' as const,
      stageIndex: tpl.stageIndex,
      parallelType: tpl.parallelType,
    };

    if (tpl.approverType === 'direct_manager') {
      const mgr = resolveManagerByLevel(currentUser.id, allUsers, 0);
      steps.push({ ...base, userId: mgr?.id ?? '', userName: mgr?.name ?? '（上長未設定）', position: mgr?.position, avatar: mgr?.avatar });

    } else if (tpl.approverType === 'second_manager') {
      const mgr = resolveManagerByLevel(currentUser.id, allUsers, 1);
      steps.push({ ...base, userId: mgr?.id ?? '', userName: mgr?.name ?? '（2段階上長未設定）', position: mgr?.position, avatar: mgr?.avatar });

    } else if (tpl.approverType === 'third_manager') {
      const mgr = resolveManagerByLevel(currentUser.id, allUsers, 2);
      steps.push({ ...base, userId: mgr?.id ?? '', userName: mgr?.name ?? '（3段階上長未設定）', position: mgr?.position, avatar: mgr?.avatar });

    } else if (tpl.approverType === 'specific_user') {
      const u = allUsers.find(u => u.id === tpl.approverUserId);
      steps.push({ ...base, userId: u?.id ?? '', userName: u?.name ?? '（ユーザー未設定）', position: u?.position, avatar: u?.avatar });

    } else if (tpl.approverType === 'role') {
      // role の場合: 当該 position を持つアクティブユーザー全員を OR グループとして展開
      // ただしシンプルに最初の1名を代表として設定し、parallelType: 'or' で追加
      const matched = allUsers.filter(u => u.status === 'active' && u.role === 'admin');
      if (matched.length === 0) {
        steps.push({ ...base, userId: '', userName: `${ROLE_LABEL[tpl.approverRole ?? ''] ?? tpl.approverRole}（未設定）` });
      } else if (matched.length === 1) {
        steps.push({ ...base, userId: matched[0].id, userName: matched[0].name, position: matched[0].position, avatar: matched[0].avatar });
      } else {
        matched.forEach((u) => {
          steps.push({ ...base, stageIndex: tpl.stageIndex, parallelType: 'or', userId: u.id, userName: u.name, position: u.position, avatar: u.avatar });
        });
      }

    } else if (tpl.approverType === 'approval_group') {
      const groupUsers = (tpl.approverGroupIds ?? []).map(id => allUsers.find(u => u.id === id)).filter(Boolean) as User[];
      if (groupUsers.length === 0) {
        steps.push({ ...base, userId: '', userName: '（グループ未設定）' });
      } else {
        groupUsers.forEach(u => {
          steps.push({ ...base, parallelType: tpl.parallelType ?? 'or', userId: u.id, userName: u.name, position: u.position, avatar: u.avatar });
        });
      }
    }
  }

  return steps;
}
