'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { printApprovalPdf } from '@/lib/export/approval-pdf';
import { getDataProvider } from '@/lib/repository/factory';
import { Task, AuditLog, Category, Delegation } from '@/lib/repository/types';
import { useAuth } from '@/context/auth-context';
import { toast } from 'sonner';
import { TaskListPanel } from '@/components/inbox/task-list-panel';
import { RejectModal } from '@/components/inbox/reject-modal';
import { ChangeApproverModal } from '@/components/inbox/change-approver-modal';

const TaskDetailPanel = dynamic(
  () => import('@/components/inbox/task-detail-panel').then(mod => mod.TaskDetailPanel),
  {
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    ),
  }
);

export default function RequestInbox() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [commentText, setCommentText] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [showChangeApproverModal, setShowChangeApproverModal] = useState(false);
  const [changingStepIndex, setChangingStepIndex] = useState<number | null>(null);
  const [allUsers, setAllUsers] = useState<import('@/lib/repository/types').User[]>([]);
  const [approverSearchQuery, setApproverSearchQuery] = useState('');
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const now = new Date('2026-04-02T09:05:57Z');

  const fetchTasks = useCallback(async (selectFirst = false) => {
    const provider = getDataProvider();
    const allTasks = await provider.getTasks();
    setTasks(allTasks);
    if (selectFirst && allTasks.length > 0) setSelectedTask(allTasks[0]);
  }, []);

  useEffect(() => {
    fetchTasks(true);
    const provider = getDataProvider();
    provider.getCategories().then(setCategories);
    provider.getUsers().then(setAllUsers);
    provider.getDelegations().then(setDelegations);
  }, [fetchTasks]);

  useEffect(() => {
    const fetchLogs = async () => {
      if (selectedTask) {
        const provider = getDataProvider();
        const auditLogs = await provider.getAuditLogs(selectedTask.id);
        setLogs(auditLogs);
      }
    };
    fetchLogs();
  }, [selectedTask]);

  const handleApprove = async () => {
    if (!selectedTask || !user || isProcessing) return;
    setIsProcessing(true);
    const provider = getDataProvider();
    try {
      const updated = await provider.processApproval(selectedTask.id, user.id, 'approve');
      setSelectedTask(updated);
      await fetchTasks();
      const newLogs = await provider.getAuditLogs(selectedTask.id);
      setLogs(newLogs);
      toast.success('承認しました');
    } catch (error) {
      toast.error('承認処理に失敗しました');
      console.error('Approval failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!selectedTask || !user || isProcessing) return;
    setIsProcessing(true);
    const provider = getDataProvider();
    try {
      const updated = await provider.processApproval(selectedTask.id, user.id, 'acknowledge');
      setSelectedTask(updated);
      await fetchTasks();
      const newLogs = await provider.getAuditLogs(selectedTask.id);
      setLogs(newLogs);
      toast.success('確認しました');
    } catch (error) {
      toast.error('確認処理に失敗しました');
      console.error('Acknowledge failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = () => {
    setRejectComment('');
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedTask || !user || !rejectComment.trim() || isProcessing) return;
    setIsProcessing(true);
    const provider = getDataProvider();
    try {
      const updated = await provider.processApproval(selectedTask.id, user.id, 'reject', rejectComment.trim());
      setSelectedTask(updated);
      await fetchTasks();
      const newLogs = await provider.getAuditLogs(selectedTask.id);
      setLogs(newLogs);
      setShowRejectModal(false);
      setRejectComment('');
      toast.success('差し戻しました');
    } catch (error) {
      toast.error('差し戻し処理に失敗しました');
      console.error('Rejection failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenChangeApprover = (stepIndex: number) => {
    setChangingStepIndex(stepIndex);
    setApproverSearchQuery('');
    setShowChangeApproverModal(true);
  };

  const handleConfirmChangeApprover = async (newApproverId: string) => {
    if (!selectedTask || changingStepIndex === null) return;
    const provider = getDataProvider();
    try {
      const updated = await provider.updateApprovalRoute(selectedTask.id, changingStepIndex, newApproverId);
      setSelectedTask(updated);
      await fetchTasks();
      const newLogs = await provider.getAuditLogs(selectedTask.id);
      setLogs(newLogs);
      setShowChangeApproverModal(false);
      setChangingStepIndex(null);
      toast.success('承認者を変更しました');
    } catch (error) {
      toast.error('承認者の変更に失敗しました');
      console.error('Change approver failed:', error);
    }
  };

  const handleExportPdf = () => {
    if (!selectedTask) return;
    printApprovalPdf(selectedTask, allUsers);
  };

  const handleAddComment = async () => {
    if (!selectedTask || !user || !commentText.trim()) return;
    const provider = getDataProvider();
    await provider.addComment(selectedTask.id, user.id, commentText);
    const newLogs = await provider.getAuditLogs(selectedTask.id);
    setLogs(newLogs);
    setCommentText('');
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-0 border rounded-3xl bg-white notion-shadow overflow-hidden group">
      <TaskListPanel
        tasks={tasks}
        selectedTask={selectedTask}
        user={user}
        categories={categories}
        allUsers={allUsers}
        now={now}
        onSelectTask={setSelectedTask}
      />

      <RejectModal
        show={showRejectModal}
        isProcessing={isProcessing}
        rejectComment={rejectComment}
        onChange={setRejectComment}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleConfirmReject}
      />

      <ChangeApproverModal
        show={showChangeApproverModal}
        changingStepIndex={changingStepIndex}
        selectedTask={selectedTask}
        allUsers={allUsers}
        approverSearchQuery={approverSearchQuery}
        onSearchChange={setApproverSearchQuery}
        onClose={() => setShowChangeApproverModal(false)}
        onConfirm={handleConfirmChangeApprover}
      />

      <TaskDetailPanel
        selectedTask={selectedTask}
        onClose={() => setSelectedTask(null)}
        logs={logs}
        allUsers={allUsers}
        delegations={delegations}
        user={user}
        isProcessing={isProcessing}
        commentText={commentText}
        onCommentChange={setCommentText}
        now={now}
        onApprove={handleApprove}
        onAcknowledge={handleAcknowledge}
        onReject={handleReject}
        onOpenChangeApprover={handleOpenChangeApprover}
        onExportPdf={handleExportPdf}
        onAddComment={handleAddComment}
      />
    </div>
  );
}
