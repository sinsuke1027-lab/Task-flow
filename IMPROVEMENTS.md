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
| P0-6 | Row Level Security (RLS) ポリシー設定（API レベル認可） | Supabase コンソール | ✅ |
| P0-7 | 入力バリデーション強化：`zod` 導入・`validateField()` 置き換え・ReDoS 対策 | `src/app/request/page.tsx` | ✅ |
| P0-8 | ファイルアップロード検証（最大10MB・許可拡張子リスト） | `src/app/request/page.tsx` | ✅ |

---

### Phase 2 — テスト基盤・CI/CD・エラーハンドリング（P1）

| # | 内容 | 対象ファイル | ステータス |
|---|------|------------|----------|
| P1-1 | Vitest + React Testing Library + jest-dom 導入 | `package.json`, `vitest.config.ts`（新規） | ✅ |
| P1-2 | `workflow-utils.ts` ユニットテスト（`isMyTurn`, `resolveWorkflowTemplate` 境界値） | `src/lib/workflow-utils.test.ts`（新規） | ✅ |
| P1-3 | `mock-provider.ts` 統合テスト（`processApproval`, `createTask`） | `src/lib/repository/mock-provider.test.ts`（新規） | ✅ |
| P1-4 | Playwright E2E テスト（ログイン → 申請 → 承認 → 完了 の黄金パス） | `e2e/approval-flow.spec.ts`（新規） | ✅ |
| P1-5 | CI パイプライン拡充：`ci.yml` に build + test + `npm audit` を追加 | `.github/workflows/ci.yml` | ✅ |
| P1-6 | デプロイパイプライン作成（GCP Cloud Run 自動デプロイ）→ **GCP-D1 に詳細** | `.github/workflows/deploy.yml`（新規） | ⬜ |
| P1-7 | `error.tsx` / `loading.tsx` を全ページに追加 | `src/app/error.tsx`, `src/app/loading.tsx`（新規） | ✅ |
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
| P3-4 | レート制限・DDoS 対策（GCP Cloud Armor + `middleware.ts` でレート制限） | `middleware.ts` | ⬜ |
| P3-5 | GDPR 対応（ユーザーデータ削除 API・同意管理・PII マスキング） | `src/app/api/`（新規） | ⬜ |

---

### Phase 5 — GCP 試験運用

> **前提アーキテクチャ：** GCP Cloud Run（asia-northeast1）+ Supabase SaaS（DB・認証）  
> **認証方式：** メールアドレス＋パスワード（試験運用）→ 将来 SAML/SSO（P3-1）へ移行  
> **デプロイ：** Cloud Build トリガー（試験）→ GitHub Actions 自動化（本番・P1-6 更新）

#### ステータス凡例（共通）
- ✅ 完了 / 🔄 対応中 / ⬜ 未対応

---

#### GCP-A — コード変更のみ（GCP プロジェクト不要 → **今すぐ着手可**）

| # | 内容 | 対象ファイル | ステータス |
|---|------|------------|----------|
| GCP-A1 | Dockerfile 作成（Node.js 20 alpine、マルチステージビルド） | `Dockerfile`（新規） | ⬜ |
| GCP-A2 | .dockerignore 作成（`node_modules`, `.next`, `.env*`, `e2e/` 等を除外） | `.dockerignore`（新規） | ⬜ |
| GCP-A3 | `next.config.ts` に `output: 'standalone'` 追加（Docker イメージ軽量化） | `next.config.ts` | ⬜ |
| GCP-A4 | `cloudbuild.yaml` 作成（Docker ビルド → Artifact Registry プッシュ → Cloud Run デプロイ） | `cloudbuild.yaml`（新規） | ⬜ |
| GCP-A5 | `.env.production.example` 作成（必要な環境変数テンプレート） | `.env.production.example`（新規） | ⬜ |

---

#### GCP-B — Supabase 設定（GCP プロジェクト不要 → **今すぐ着手可**）

| # | 内容 | 対象ファイル | ステータス |
|---|------|------------|----------|
| GCP-B1 | Supabase プロジェクト作成（無料枠・US East で試験開始） | Supabase Dashboard | ⬜ |
| GCP-B2 | マイグレーション実行（`001_initial_schema.sql` → `002_rls_policies.sql`） | `supabase/migrations/` | ⬜ |
| GCP-B3 | Email 認証有効化・パスワードポリシー設定（12文字以上推奨） | Supabase Dashboard | ⬜ |
| GCP-B4 | Site URL / Redirect URL に Cloud Run URL を追加（GCP-C6 完了後） | Supabase Dashboard | ⬜ |

---

#### GCP-C — GCP インフラ設定（GCP プロジェクト作成後）

| # | 内容 | 対象ファイル | ステータス |
|---|------|------------|----------|
| GCP-C1 | GCP プロジェクト作成・必要 API 有効化（Cloud Run / Artifact Registry / Cloud Build / Secret Manager） | GCP Console | ⬜ |
| GCP-C2 | Artifact Registry リポジトリ作成（`asia-northeast1`、Docker 形式） | GCP Console | ⬜ |
| GCP-C3 | Cloud Build サービスアカウントに権限付与（`roles/run.admin`, `artifactregistry.writer`, `secretmanager.secretAccessor`） | GCP Console | ⬜ |
| GCP-C4 | Secret Manager にシークレット登録（`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_DATA_PROVIDER=supabase`） | GCP Console | ⬜ |
| GCP-C5 | Cloud Build トリガー設定（`main` ブランチプッシュ → `cloudbuild.yaml` 実行） | GCP Console | ⬜ |
| GCP-C6 | Cloud Run サービス設定（min-instances:1、max-instances:10、512Mi、`asia-northeast1`） | GCP Console / `cloudbuild.yaml` | ⬜ |

---

#### GCP-D — 試験運用後の継続整備

| # | 内容 | 対象ファイル | ステータス |
|---|------|------------|----------|
| GCP-D1 | `deploy.yml` 作成（Workload Identity Federation 利用・GitHub Actions 自動デプロイ）※ P1-6 を GCP 向けに更新 | `.github/workflows/deploy.yml`（新規） | ⬜ |
| GCP-D2 | `/api/health` エンドポイント作成（Cloud Monitoring アップタイムチェック用） | `src/app/api/health/route.ts`（新規） | ⬜ |
| GCP-D3 | Cloud Monitoring アラート設定（エラーレート・レイテンシ > 3秒） | GCP Console | ⬜ |
| GCP-D4 | Supabase Pro 移行（東京リージョン・接続数無制限・自動停止なし）※数百人規模移行時 | Supabase Dashboard | ⬜ |

---

#### 着手順序まとめ

```
STEP 1（今すぐ）    GCP-A1〜A5 + GCP-B1〜B3  ← コード変更 + Supabase 設定のみ
STEP 2（GCP 設定後） GCP-C1〜C6               ← GCP プロジェクト作成後に一気に進める
STEP 3（デプロイ後） GCP-B4（Supabase URL 追加） ← Cloud Run URL 確定後
STEP 4（安定後）    GCP-D1〜D4               ← CI/CD 自動化・監視整備
```

---

#### GCP 試験運用と連携する既存タスク（Phase 2〜4 より）

GCP へのデプロイ前後に対応しておくと効果が高い既存タスクを抜粋。

| 優先度 | タスク | 理由 |
|-------|-------|------|
| 🔴 試験運用前に必須 | P1-7（error.tsx / loading.tsx） | Cloud Run でのエラーをユーザーに適切に表示するため |
| 🔴 試験運用前に必須 | P1-8（Toast 通知） | console.error のまま本番デプロイするのは UX 上問題あり |
| 🟡 試験運用前に推奨 | P2-4（Code Splitting） | Cold Start 時間を短縮。Cloud Run の min-instances=0 時に顕著 |
| 🟡 試験運用前に推奨 | P2-8（Bundle 分析 + Core Web Vitals） | 数百人規模への移行前にボトルネック特定 |
| 🟡 試験運用中に整備 | P2-7（Sentry） | Cloud Error Reporting と並用。フロントエンドエラーを可視化 |
| 🟠 本番移行前に対応 | P2-6（admin/inbox コンポーネント分割） | 大規模ユーザー対応時のメンテナビリティ向上 |
| 🟠 本番移行前に対応 | P3-4（レート制限・DDoS 対策） | ※ GCP では Vercel Edge でなく **Cloud Armor** で対応。`middleware.ts` に加えて Cloud Armor ルール設定 |
| 🔵 将来対応 | P3-1（SAML/SSO） | 試験運用はメール認証。本番展開後に Supabase Auth で追加 |
| 🔵 将来対応 | P2-9（通知システム） | Supabase Realtime は GCP Cloud Run でも動作するが、SendGrid 設定が別途必要 |

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
