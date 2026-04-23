import { Task, User } from '@/lib/repository/types';

/** ステータスラベル変換 */
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    todo: '未着手', in_progress: '対応中', completed: '完了',
  };
  return map[status] ?? status;
}

/** 優先度ラベル変換 */
function priorityLabel(priority: string): string {
  return priority === 'high' ? '急ぎ' : priority === 'low' ? '低' : '通常';
}

/** 承認ステータスラベル */
function stepStatusLabel(status: string): string {
  return status === 'approved' ? '承認済' : status === 'rejected' ? '差し戻し' : '待機中';
}

/** 稟議書 HTML を生成する */
export function generateApprovalPdfHtml(task: Task, allUsers: User[]): string {
  const requester = allUsers.find(u => u.id === task.requesterId);
  const approvedAt = task.approvalRoute.filter(s => s.status === 'approved').slice(-1)[0]?.processedAt;

  const customRows = task.customData
    ? Object.entries(task.customData)
        .map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`)
        .join('')
    : '';

  const routeRows = (task.approvalRoute ?? [])
    .map((step, i) => {
      const processedDate = step.processedAt
        ? new Date(step.processedAt).toLocaleString('ja-JP')
        : '—';
      return `
        <tr>
          <td style="text-align:center;">${i + 1}</td>
          <td>${step.position ?? ''}</td>
          <td>${step.userName}</td>
          <td style="text-align:center;">${stepStatusLabel(step.status)}</td>
          <td>${processedDate}</td>
          <td>${step.comment ?? ''}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>稟議書 — ${task.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif; font-size: 11pt; color: #1a1a1a; padding: 20mm 18mm; }
    h1 { font-size: 18pt; font-weight: bold; text-align: center; margin-bottom: 6mm; letter-spacing: 0.1em; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 8mm; }
    .meta-table th, .meta-table td { border: 1px solid #aaa; padding: 3mm 4mm; font-size: 10pt; }
    .meta-table th { background: #f0f0f0; width: 30%; font-weight: bold; }
    .section-title { font-size: 11pt; font-weight: bold; background: #e8e8e8; padding: 2mm 4mm; margin: 6mm 0 2mm; border-left: 4px solid #333; }
    .description-box { border: 1px solid #ccc; padding: 4mm; min-height: 20mm; font-size: 10pt; line-height: 1.7; white-space: pre-wrap; }
    .route-table { width: 100%; border-collapse: collapse; margin-top: 2mm; font-size: 9.5pt; }
    .route-table th, .route-table td { border: 1px solid #aaa; padding: 2.5mm 3mm; }
    .route-table th { background: #f0f0f0; font-weight: bold; text-align: center; }
    .footer { margin-top: 10mm; font-size: 9pt; color: #666; text-align: right; }
    @media print { body { padding: 15mm 12mm; } }
  </style>
</head>
<body>
  <h1>稟　議　書</h1>

  <table class="meta-table">
    <tr><th>申請番号</th><td>${task.id}</td><th>申請日</th><td>${new Date(task.createdAt).toLocaleDateString('ja-JP')}</td></tr>
    <tr><th>申請者</th><td>${requester?.name ?? task.requesterId}（${requester?.position ?? ''}）</td><th>ステータス</th><td>${statusLabel(task.status)}</td></tr>
    <tr><th>カテゴリー</th><td>${task.category ?? ''}</td><th>優先度</th><td>${priorityLabel(task.priority)}</td></tr>
    <tr><th>期限（SLA）</th><td>${new Date(task.dueDate).toLocaleDateString('ja-JP')}</td><th>最終承認日</th><td>${approvedAt ? new Date(approvedAt).toLocaleDateString('ja-JP') : '—'}</td></tr>
  </table>

  <div class="section-title">件名</div>
  <div class="description-box" style="padding:3mm 4mm; font-size:12pt; font-weight:bold;">${task.title}</div>

  <div class="section-title">申請内容・詳細説明</div>
  <div class="description-box">${task.description || '（記載なし）'}</div>

  ${customRows ? `
  <div class="section-title">追加入力項目</div>
  <table class="meta-table">${customRows}</table>` : ''}

  <div class="section-title">承認ルート</div>
  <table class="route-table">
    <thead>
      <tr>
        <th style="width:6%">順番</th>
        <th style="width:18%">役職</th>
        <th style="width:20%">承認者</th>
        <th style="width:12%">ステータス</th>
        <th style="width:20%">処理日時</th>
        <th>コメント</th>
      </tr>
    </thead>
    <tbody>${routeRows}</tbody>
  </table>

  <div class="footer">出力日時: ${new Date().toLocaleString('ja-JP')} — TaskFlow</div>
</body>
</html>`;
}

/** 稟議書を新ウィンドウで開いて印刷ダイアログを表示する */
export function printApprovalPdf(task: Task, allUsers: User[]): void {
  const html = generateApprovalPdfHtml(task, allUsers);
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('ポップアップがブロックされています。ブラウザの設定を確認してください。');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

/** タスク一覧を CSV としてダウンロードする */
export function downloadTasksCsv(tasks: Task[], allUsers: User[], filename = 'tasks.csv'): void {
  const headers = ['申請ID', 'タイトル', 'カテゴリー', 'ステータス', '優先度', '申請者', '現在の担当者', '作成日', '期限'];
  const rows = tasks.map(t => [
    t.id,
    t.title,
    t.category ?? '',
    statusLabel(t.status),
    priorityLabel(t.priority),
    allUsers.find(u => u.id === t.requesterId)?.name ?? t.requesterId,
    t.currentApproverName ?? '—',
    new Date(t.createdAt).toLocaleDateString('ja-JP'),
    new Date(t.dueDate).toLocaleDateString('ja-JP'),
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
