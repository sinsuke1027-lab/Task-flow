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

---

## 商用化ロードマップ

### ステータス凡例（共通）
- ✅ 完了 / 🔄 対応中 / ⬜ 未対応

---

### Phase 1 — バックエンド・認証基盤（P0）

| # | 内容 | 対象ファイル | ステータス |
|---|------|------------|----------|
| P0-1 | Supabase 導入・PostgreSQL スキーマ設計（全テーブルに `tenant_id` 付与） | `src/lib/repository/types.ts`, `src/lib/repository/factory.ts` | ✅ |
| P0-2 | `SupabaseDataProvider` 実装（`DataProvider` インターフェース継承） | `src/lib/repository/supabase-provider.ts`（新規） | ✅ |
| P0-3 | DBマイグレーションファイル作成 | `supabase/migrations/001_initial_schema.sql`（新規） | ✅ |
| P0-4 | 認証リプレース：`auth-context.tsx` を Supabase Auth + HTTP-Only Cookie に変更 | `src/context/auth-context.tsx`, `src/app/login/page.tsx` | ✅ |
| P0-5 | Next.js Middleware でサーバー側認証チェック追加 | `middleware.ts`（新規） | ✅ |
| P0-6 | Row Level Security (RLS) ポリシー設定（API レベル認可） | Supabase コンソール | ⬜ |
| P0-7 | 入力バリデーション強化：`zod` 導入・`validateField()` 置き換え・ReDoS 対策 | `src/app/request/page.tsx` | ⬜ |
| P0-8 | ファイルアップロード検証（最大10MB・許可拡張子リスト） | `src/app/request/page.tsx` | ✅ |

---

### Phase 2 — テスト基盤・CI/CD・エラーハンドリング（P1）

| # | 内容 | 対象ファイル | ステータス |
|---|------|------------|----------|
| P1-1 | Vitest + React Testing Library + jest-dom 導入 | `package.json`, `vitest.config.ts`（新規） | ⬜ |
| P1-2 | `workflow-utils.ts` ユニットテスト（`isMyTurn`, `resolveWorkflowTemplate` 境界値） | `src/lib/workflow-utils.test.ts`（新規） | ⬜ |
| P1-3 | `mock-provider.ts` 統合テスト（`processApproval`, `createTask`） | `src/lib/repository/mock-provider.test.ts`（新規） | ⬜ |
| P1-4 | Playwright E2E テスト（ログイン → 申請 → 承認 → 完了 の黄金パス） | `e2e/approval-flow.spec.ts`（新規） | ⬜ |
| P1-5 | CI パイプライン拡充：`ci.yml` に build + test + `npm audit` を追加 | `.github/workflows/ci.yml` | ⬜ |
| P1-6 | デプロイパイプライン作成（Vercel/Railway 自動デプロイ） | `.github/workflows/deploy.yml`（新規） | ⬜ |
| P1-7 | `error.tsx` / `loading.tsx` を全ページに追加 | `src/app/error.tsx`, `src/app/loading.tsx`（新規） | ⬜ |
| P1-8 | Toast 通知ライブラリ導入（`sonner` 推奨）・各ページの `console.error` を通知に置き換え | `src/app/inbox/page.tsx`, `src/app/tracker/page.tsx`, `src/app/admin/page.tsx` | ⬜ |

---

### Phase 3 — UX・品質向上（P2）

| # | 内容 | 対象ファイル | ステータス |
|---|------|------------|----------|
| P2-1 | 全アイコンボタンに `aria-label` 付与・モーダル focus trap 実装 | 全ページ | ⬜ |
| P2-2 | `<label>` と `<input>` の紐付け統一（date input 含む） | `src/app/request/page.tsx` 他 | ⬜ |
| P2-3 | WCAG 2.1 AA カラーコントラスト確認・修正 | Tailwind CSS 設定 | ⬜ |
| P2-4 | `next/dynamic` によるページ単位 Code Splitting | `src/app/admin/page.tsx`, `src/app/inbox/page.tsx` | ⬜ |
| P2-5 | `OrgNode` 再帰描画に `React.memo` 適用 | `src/components/organization/org-node.tsx` | ⬜ |
| P2-6 | `admin/page.tsx`（1,550行）・`inbox/page.tsx`（1,005行）をコンポーネント分割 | 上記2ファイル | ⬜ |
| P2-7 | Sentry 導入（エラー監視・PII マスキング設定） | `sentry.client.config.ts`, `sentry.server.config.ts`（新規） | ⬜ |
| P2-8 | Bundle サイズ分析 + Core Web Vitals 計測・改善（LCP < 2.5s 目標） | `next.config.ts` | ⬜ |

---

### Phase 4 — 機能追加（P2〜P3）

| # | 内容 | 対象ファイル | ステータス |
|---|------|------------|----------|
| P2-9 | 通知システム（Supabase Realtime + SendGrid によるアプリ内・メール通知） | `src/app/api/notifications/`（新規） | ⬜ |
| P2-10 | 監査ログの期間フィルタリング（admin 画面） | `src/app/admin/page.tsx` | ⬜ |
| P2-11 | 金額ルール UI 実装（`AmountRule` スキーマは実装済み、UI が未実装） | `src/app/request/page.tsx` | ⬜ |
| P2-12 | マルチテナント管理 UI（テナント作成・設定画面） | `src/app/admin/page.tsx` | ⬜ |
| P2-13 | Excel（XLSX）出力対応 | `src/lib/export/`（新規ファイル追加） | ⬜ |
| P2-14 | 外部連携用 REST API エンドポイント（BI ツール向け） | `src/app/api/`（新規） | ⬜ |
| P3-1 | SAML/SSO 対応（Google Workspace, Microsoft Entra） | `src/context/auth-context.tsx` | ⬜ |
| P3-2 | 承認ルート動的編集 UI（`updateApprovalRoute()` は実装済み、UI が未実装） | `src/app/inbox/page.tsx` | ⬜ |
| P3-3 | i18n 対応（`next-intl` 導入・日本語 + 英語） | 全ページ | ⬜ |
| P3-4 | レート制限・DDoS 対策（Vercel Edge / Cloudflare Workers） | `middleware.ts` | ⬜ |
| P3-5 | GDPR 対応（ユーザーデータ削除 API・同意管理・PII マスキング） | `src/app/api/`（新規） | ⬜ |

---

### 推奨追加パッケージ

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x",
    "zod": "^3.x",
    "sonner": "^1.x",
    "date-fns": "^3.x",
    "@sentry/nextjs": "^8.x"
  },
  "devDependencies": {
    "vitest": "^2.x",
    "@testing-library/react": "^16.x",
    "@testing-library/jest-dom": "^6.x",
    "@playwright/test": "^1.x",
    "@next/bundle-analyzer": "^16.x"
  }
}
```
