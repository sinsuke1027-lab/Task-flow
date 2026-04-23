# TaskFlow 改修管理ドキュメント

## ステータス凡例
- ✅ 完了
- 🔄 対応中
- ⬜ 未対応

---

## バグ修正・品質改善

### P1 — 機能バグ（即時修正）

| # | 問題 | ファイル | ステータス |
|---|------|---------|----------|
| 1 | `processApproval` が存在しないステータスID `status_completed` を使用（正: `status_done`） | `src/lib/repository/mock-provider.ts` | ✅ |
| 2 | 承認後に `currentApproverId` / `currentApproverName` が更新されない | `src/lib/repository/mock-provider.ts` | ✅ |
| 3 | `createTask` で `currentApproverId` が初期化されない | `src/lib/repository/mock-provider.ts` | ✅ |
| 4 | `OrgNode` 再帰呼び出し時に `isExpandedInitial` が渡されない | `src/components/organization/org-node.tsx` | ✅ |

### P2 — 型安全性・表示崩れ

| # | 問題 | ファイル | ステータス |
|---|------|---------|----------|
| 5 | `User.role` 型 vs `users.json` の値不整合（正規化で対応済み） | `src/lib/repository/types.ts` | ✅ |
| 6 | `tasks.json` の `approvalSteps` / `approverId` vs 型定義の `approvalRoute` / `userId` 不一致（フォールバックで対応済み） | `src/lib/repository/mock-provider.ts` | ✅ |
| 7 | `inbox/page.tsx` で `user` の null チェック漏れ（既存ガードで対応済み） | `src/app/inbox/page.tsx` | ✅ |
| 8 | `page.tsx` の `user!` 非null断言 | `src/app/page.tsx` | ✅ |
| 9 | `RootLayout` が `'use client'` → metadata / SSR 不可 | `src/app/layout.tsx` | ✅ |

### P3 — 保守性・UX

| # | 問題 | ファイル | ステータス |
|---|------|---------|----------|
| 10 | `window.location.reload()` → `fetchData()` refetch に変更 | `src/app/admin/page.tsx` | ✅ |
| 11 | `as any` キャスト（`setActiveTab`, `setChangeType`） | `src/app/admin/page.tsx` | ✅ |
| 12 | `StatsCard` の `icon: any` → `React.ReactNode` | `src/app/page.tsx` | ✅ |
| 13 | Status label の日本語ハードコード → ID ベース比較に変更 | `src/lib/repository/mock-provider.ts` | ✅ |
| 14 | Sidebar ロール判定で `user_admin_1` をハードコード | `src/components/layout/sidebar.tsx` | ✅ |
| 15 | `ClientOnlyDate` で Invalid Date 未処理 | `src/components/common/client-only-date.tsx` | ✅ |
| 16 | アバター画像が undefined のとき `src="undefined"` が出力される | `src/app/page.tsx` | ✅ |

### P4 — 低優先（将来対応）

| # | 問題 | ファイル | ステータス |
|---|------|---------|----------|
| 17-inbox | inbox 承認・差し戻しボタンにハンドラ未実装 | `src/app/inbox/page.tsx` | ✅ |
| 17-request | request ファイル添付エリアが非機能 | `src/app/request/page.tsx` | ✅ |
| 18 | 組織図の検索 input に debounce がない | `src/app/organization/page.tsx` | ✅ |
| 19 | admin 監査ログの `localStorage` 操作をイベントハンドラ内で実行 | `src/app/admin/page.tsx` | ✅ |
| 20 | `factory.ts` のシングルトン管理が薄い（実DB切り替え時の設計問題） | `src/lib/repository/factory.ts` | ✅ |

---

## 機能追加

### A — 高効果・低コスト

| # | 機能 | 対象ファイル | ステータス |
|---|------|------------|----------|
| A-3 | 承認進捗バー（カードに進捗バー、詳細モーダルにステッパー表示） | `src/app/tracker/page.tsx` | ✅ |
| A-2 | 申請キャンセル機能（未処理申請の取り消し、監査ログ記録） | `src/app/tracker/page.tsx` | ✅ |
| A-1 | 優先度設定（フォームに低/通常/急ぎ選択 + カード・詳細バッジ） | `src/app/request/page.tsx`, `src/app/tracker/page.tsx` | ✅ |

### B — 高効果・中コスト

| # | 機能 | 対象ファイル | ステータス |
|---|------|------------|----------|
| B-2 | トラッカーの検索・フィルター（キーワード + ステータス） | `src/app/tracker/page.tsx` | ✅ |
| B-1 | 差し戻し後の再申請（修正して同IDで再送信） | `src/app/tracker/page.tsx`, `src/app/request/page.tsx` | ✅ |

### C — 中効果・中コスト

| # | 機能 | 対象ファイル | ステータス |
|---|------|------------|----------|
| C-1 | 下書き保存（localStorage 自動保存 + 復元バナー） | `src/app/request/page.tsx` | ✅ |

---

## 将来のロードマップ（README 記載）

| 項目 | 概要 | ステータス |
|------|------|----------|
| バックエンド永続化 | Mock → Supabase 等の実DB へ移行 | ⬜ |
| 通知システム | メール・システム内通知の強化 | ⬜ |
| 監査ログの期間フィルタリング | admin 画面での詳細フィルター | ⬜ |
