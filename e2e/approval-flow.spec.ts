import { test, expect } from '@playwright/test';

const MEMBER_NAME = '渡辺 洋子';
const ADMIN_NAME = '佐藤 健二';

test('申請から承認・完了までの黄金パス', async ({ page }) => {
  const TASK_TITLE = `E2E名刺申請 ${Date.now()}`;

  // ── 0. 初期化：ストレージをクリア ──
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // ── 1. 一般社員（渡辺 洋子）でログイン ──
  await page.getByRole('button', { name: new RegExp(MEMBER_NAME) }).click();
  await expect(page).not.toHaveURL(/login/);

  // ── 2. 申請フォームへ移動 ──
  await page.goto('/request');

  // ── 3. カテゴリー選択（大分類：総務・庶務 → 中分類：名刺申請）──
  await page.locator('select').first().selectOption('cat_ga');
  await expect(page.locator('select').nth(1)).not.toBeDisabled();
  await page.locator('select').nth(1).selectOption('cat_ga_meishi');

  // ── 4. タイトル入力 ──
  await page.getByPlaceholder('例：2026年度 資格取得祝金申請').fill(TASK_TITLE);

  // ── 5. 名刺申請の必須カスタムフィールド入力 ──
  // 役職（text, required）
  await page.locator('#field-meishi_yakushoku input').fill('テスト役職');
  // 名刺の枚数（select, required）
  await page.locator('#field-meishi_count select').selectOption({ index: 1 });
  // 受取方法（select, required）
  await page.locator('#field-meishi_receive select').selectOption({ index: 1 });

  // ── 6. 申請送信 ──
  await page.getByRole('button', { name: '申請を送信する' }).click();

  // ── 7. トラッカーへリダイレクトされ、申請が表示されることを確認 ──
  await expect(page).toHaveURL('/tracker');
  await expect(page.getByText(TASK_TITLE)).toBeVisible();

  // ── 8. ユーザー切替：管理部門（佐藤 健二）でログイン ──
  // 認証情報のみ削除（モックデータ tb_state は保持する）
  await page.evaluate(() => localStorage.removeItem('task_bridge_user_id'));
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(ADMIN_NAME) }).click();
  await expect(page).not.toHaveURL(/login/);

  // ── 9. 受信トレイへ移動・申請を検索して選択 ──
  await page.goto('/inbox');
  await page.getByPlaceholder('依頼を検索...').fill(TASK_TITLE);
  await page.locator('button', { hasText: TASK_TITLE }).first().click();

  // ── 10. 承認 ──
  await expect(page.getByRole('button', { name: '承認・受理する' })).toBeVisible();
  await page.getByRole('button', { name: '承認・受理する' }).click();

  // fetchTasks の完了を待つ
  await page.waitForTimeout(1000);

  // ── 11. タスクを再選択してステータスを更新 ──
  await page.locator('button', { hasText: TASK_TITLE }).first().click();

  // ── 12. タスクが「完了」になったことを確認 ──
  await expect(page.getByRole('button', { name: '再利用して申請' })).toBeVisible();
});
