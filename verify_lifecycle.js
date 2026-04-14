
const { MockDataProvider } = require('./src/lib/repository/mock-provider');

async function verify() {
  const provider = MockDataProvider.getInstance();
  
  console.log('--- Phase 1: Task Creation ---');
  // Initialize with initial data if needed
  await provider.getTasks();
  
  const task = await provider.createTask({
    title: '監査ログ検証用申請',
    description: 'テスタ',
    categoryId: 'cat_it_pc',
    requesterId: 'user_member_sales_0_0_0', // 田中 太郎
    priority: 'medium',
    data: {}
  });
  console.log('Task created:', task.id);
  
  let logs = await provider.getAuditLogs(task.id);
  console.log('Initial logs:', logs.map(l => ({ action: l.action, user: l.userName })));

  console.log('\n--- Phase 2: Personnel Change (Retirement) ---');
  // 中村 浩 (user_tl_sales_0_0) retires. His manager is 高橋 健二 (user_gm_sales_0).
  const event = await provider.scheduleUserChange({
    targetType: 'user',
    targetId: 'user_tl_sales_0_0',
    eventType: 'retire',
    scheduledAt: new Date().toISOString(),
    changes: { status: 'inactive' },
    note: 'Verification test'
  });
  
  await provider.applyUserChange(event.id);
  console.log('Retirement applied for 中村 浩');

  const tasks = await provider.getTasks();
  const updatedTask = tasks.find(t => t.id === task.id);
  console.log('New Approver:', updatedTask?.currentApproverName, `(${updatedTask?.currentApproverId})`);

  logs = await provider.getAuditLogs(task.id);
  console.log('Logs after reassignment:', logs.map(l => ({ action: l.action, user: l.userName, comment: l.comment })));

  console.log('\n--- Phase 3: Approval by New Manager ---');
  await provider.processApproval(task.id, 'user_gm_sales_0', 'approved', '手動引き継ぎ分を確認しました。');
  
  logs = await provider.getAuditLogs(task.id);
  console.log('\nFinal logs:');
  logs.forEach(l => console.log(`[${l.action}] ${l.userName}: ${l.comment}`));
}

verify().catch(console.error);
