# CI/CDパイプライン仕様 — TaskFlow

| 項目 | 内容 |
|------|------|
| システム名 | TaskFlow |
| 作成日 | 2026-05-14 |
| 参照ファイル | `.github/workflows/` |

---

## ワークフロー一覧

| ファイル名 | ワークフロー名 | トリガー | 概要 |
|-----------|--------------|---------|------|
| `ci.yml` | CI | push / PR to master | 型チェック・Lint・ビルド・テスト・脆弱性監査 |
| `deploy.yml` | Deploy to Cloud Run | push to master（対象パスのみ） | Cloud Build 経由で Cloud Run に自動デプロイ |
| `code-review.yml` | Claude Code Review | PR open / synchronize / ready_for_review | Claude による自動コードレビュー |
| `issue-auto-branch.yml` | Issue Auto Branch | Issue open / workflow_dispatch | Issue からブランチを自動作成 |
| `claude.yml` | Claude（詳細未定） | 個別設定 | Claude Code Action 汎用ワークフロー |

---

## 1. CI（`ci.yml`）

### トリガー条件

以下のパス変更があった場合に `push`（master）または `pull_request`（master）で実行される。

```
src/**
e2e/**
**/*.ts
**/*.tsx
package.json
.github/workflows/**
```

### ジョブ一覧

| ジョブ名 | 実行内容 | 失敗時の意味 |
|---------|---------|------------|
| `typecheck` | `npm run typecheck`（`tsc --noEmit`） | 型エラーあり。マージ不可 |
| `lint` | `npm run lint`（ESLint） | Lint エラーあり。マージ不可 |
| `build` | `npm run build`（Next.js プロダクションビルド） | ビルドエラーあり。マージ不可 |
| `test` | `npm test`（Vitest。E2E 除く） | ユニット・統合テスト失敗。マージ不可 |
| `audit` | `npm audit --audit-level=high` | HIGH 以上の脆弱性あり。マージ不可 |

> E2E テスト（Playwright）はヘッドレスブラウザと開発サーバーが必要なため CI では除外。ローカルで `npm run test:e2e` を実行すること。

### セットアップアクション

各ジョブは `.github/actions/setup` の composite action で Node.js と依存関係をセットアップする。

### CI 失敗時の対処

| ジョブ | 典型的な原因 | 対処 |
|--------|-----------|------|
| `typecheck` | `any` キャスト・型不一致・import 漏れ | `npm run typecheck` をローカルで実行して修正 |
| `lint` | `eslint-disable` の使用・規約違反 | `npm run lint` をローカルで実行して修正。設定ファイルは編集しない |
| `build` | `'use client'` 境界違反・import エラー | `npm run build` をローカルで実行して確認 |
| `test` | テストの失敗・モックの不整合 | `npm run test:watch` で該当テストを特定して修正 |
| `audit` | 新たな HIGH/CRITICAL 脆弱性 | `npm audit` の出力を確認し `npm update` または代替パッケージに切り替え |

---

## 2. Deploy to Cloud Run（`deploy.yml`）

### トリガー条件

`master` ブランチへの push で、かつ以下のパスに変更があった場合に実行される。

```
src/**
public/**
Dockerfile
next.config.ts
package*.json
cloudbuild.yaml
.github/workflows/deploy.yml
```

### 動作

1. Workload Identity Federation で GCP 認証（サービスアカウントキー不要）
2. `gcloud builds submit` で Cloud Build を起動
3. Cloud Build が Docker ビルド → Artifact Registry プッシュ → Cloud Run デプロイを実行

### 必要な GitHub Secrets

| シークレット名 | 説明 |
|--------------|------|
| `GCP_PROJECT_ID` | GCP プロジェクト ID |
| `WIF_PROVIDER` | Workload Identity プロバイダーのリソース名 |
| `WIF_SERVICE_ACCOUNT` | デプロイ用サービスアカウントのメール |

セットアップ手順は [GCPデプロイガイド](19_gcp-deploy.md) の STEP 6〜7 を参照。

---

## 3. Claude Code Review（`code-review.yml`）

### トリガー

PR が **ドラフト解除**（`ready_for_review`）されたとき、または更新（`synchronize`）されたとき。ドラフト PR はスキップされる（`if: github.event.pull_request.draft == false`）。

### 動作

Claude が以下の順で自動レビューを行い、PR にコメントを投稿する。

1. PR 情報・既存レビューコメントを取得
2. 紐づく Issue の要件を確認
3. コード差分を取得・分析
4. 必要に応じて context7 MCP でライブラリドキュメントを参照

### レビュー観点

- Issue の要件を完全に満たしているか
- `AGENTS.md`（設計・コーディング規約）を遵守しているか
- バグ・セキュリティリスク・パフォーマンス上の懸念がないか

### 必要なシークレット

| シークレット名 | 説明 |
|--------------|------|
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code Action の認証トークン |
| `CONTEXT7_API_KEY` | Context7 MCP（ドキュメント参照）の API キー |

---

## 3. Issue Auto Branch（`issue-auto-branch.yml`）

### トリガー

- Issue が `opened` されたとき（自動）
- `workflow_dispatch` でIssue番号を指定して手動実行

### 動作

1. Issue タイトルから英語の kebab-case スラッグを生成
2. `issue/<number>-<slug>` 形式のブランチ名を決定
3. 同名ブランチが存在する場合は `-v2`, `-v3` を付加
4. `gh issue develop` でブランチを作成し、Issue にコメントを投稿

### ブランチ命名規則

```
issue/<number>-<slug>

例:
  Issue #27「申請フォームのバリデーション強化」
  → issue/27-request-form-validation
```

- スラッグは 30文字以内
- ブランチ全体は 50文字以内
- 使用可能文字: 小文字英数字とハイフンのみ
- `feature/add/new` などの汎用語は避ける

---

## 4. PR 作成・マージのフロー

```
1. Issue 起票 → ブランチ自動作成
2. ローカルで実装
3. gh pr create --draft  ← 必ずドラフトで作成
4. CI 全ジョブ通過を確認
5. ドラフト解除 → Claude Code Review が自動実行
6. レビューコメントに対応
7. チームメンバーの承認後にマージ
```

> `main` ブランチへの直接プッシュは禁止。PR 経由でのみマージする。
