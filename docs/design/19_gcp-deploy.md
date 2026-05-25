# GCPデプロイガイド — TaskFlow

| 項目 | 内容 |
|------|------|
| システム名 | TaskFlow |
| 作成日 | 2026-05-14 |
| 最終更新 | 2026-05-25 |
| 参照ファイル | `Dockerfile`, `cloudbuild.yaml`, `.github/workflows/deploy.yml`, `IMPROVEMENTS.md Phase 5` |

---

## 1. アーキテクチャ概要

```
GitHub (master ブランチへ push)
    ↓ GitHub Actions (deploy.yml) — Workload Identity Federation で認証
Cloud Build
    ↓ Docker ビルド → Artifact Registry プッシュ → Cloud Run デプロイ
Cloud Run (asia-northeast1)
  - min-instances: 1
  - max-instances: 10
  - メモリ: 512Mi
    ↓ 環境変数は Secret Manager から注入
Supabase (DB / Auth)
  - PostgreSQL（全テーブルに tenant_id、RLS 適用済み）
  - Supabase Auth（メール＋パスワード）
```

---

## 2. コードリポジトリ側の準備状況（完了済み）

以下はすべて実装・コミット済みです。GCP 担当者は手を加えなくて構いません。

| ファイル | 内容 | 状態 |
|---------|------|------|
| `Dockerfile` | Node.js 20 Alpine マルチステージビルド | ✅ |
| `.dockerignore` | `.next`, `node_modules`, `.env*` 等を除外 | ✅ |
| `next.config.ts` | `output: 'standalone'`（Docker イメージ軽量化） | ✅ |
| `cloudbuild.yaml` | ビルド → Artifact Registry → Cloud Run デプロイ | ✅ |
| `.env.production.example` | 本番環境変数テンプレート | ✅ |
| `.github/workflows/deploy.yml` | GitHub Actions 自動デプロイ（Workload Identity Federation） | ✅ |
| `src/app/api/health/route.ts` | Cloud Run ヘルスチェック用エンドポイント（`GET /api/health`） | ✅ |
| `supabase/migrations/001_initial_schema.sql` | 全テーブル定義・RLS 有効化 | ✅ |
| `supabase/migrations/002_rls_policies.sql` | 操作別 RLS ポリシー | ✅ |
| `middleware.ts` | サーバーサイド認証チェック（Supabase Auth） | ✅ |
| `src/lib/repository/supabase-provider.ts` | Supabase DataProvider 全実装 | ✅ |

---

## 3. GCP 担当者が行う作業

### STEP 1: Supabase プロジェクトの作成

詳細手順は [DBマイグレーション手順書](18_db-migration.md) を参照。

1. [Supabase Dashboard](https://app.supabase.com) でプロジェクトを新規作成
   - リージョン: US East（試験運用）/ Tokyo（本番）
2. SQL Editor で `supabase/migrations/001_initial_schema.sql` を実行
3. SQL Editor で `supabase/migrations/002_rls_policies.sql` を実行
4. Settings > API から以下を取得してメモしておく
   - **Project URL**（例: `https://xxxx.supabase.co`）
   - **anon public key**（例: `eyJhbGc...`）
5. Authentication > Settings で Email 認証を有効化（パスワード最低12文字を推奨）

---

### STEP 2: GCP プロジェクトのセットアップ

```bash
# プロジェクト ID を変数に設定（以降のコマンドで共通使用）
PROJECT_ID=your-gcp-project-id

# 必要な API を有効化
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  --project=$PROJECT_ID
```

---

### STEP 3: Artifact Registry リポジトリの作成

```bash
gcloud artifacts repositories create task-flow \
  --repository-format=docker \
  --location=asia-northeast1 \
  --project=$PROJECT_ID
```

---

### STEP 4: サービスアカウントと IAM 設定

#### 4-1: デプロイ用サービスアカウントの作成

```bash
gcloud iam service-accounts create deploy-sa \
  --display-name="TaskFlow Deploy Service Account" \
  --project=$PROJECT_ID
```

#### 4-2: 必要な IAM ロールを付与

```bash
SA_EMAIL="deploy-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# Cloud Run のデプロイ権限
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

# Artifact Registry への書き込み権限
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

# Secret Manager の読み取り権限
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

# Cloud Build の起動権限
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudbuild.builds.builder"

# Cloud Run が Secret Manager を読めるようにする
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

### STEP 5: Secret Manager にシークレットを登録

```bash
# Supabase URL（STEP 1 で取得した値）
echo -n "https://xxxx.supabase.co" | \
  gcloud secrets create NEXT_PUBLIC_SUPABASE_URL \
  --data-file=- --project=$PROJECT_ID

# Supabase anon key（STEP 1 で取得した値）
echo -n "eyJhbGc..." | \
  gcloud secrets create NEXT_PUBLIC_SUPABASE_ANON_KEY \
  --data-file=- --project=$PROJECT_ID

# データプロバイダー（固定値）
echo -n "supabase" | \
  gcloud secrets create NEXT_PUBLIC_DATA_PROVIDER \
  --data-file=- --project=$PROJECT_ID
```

登録するシークレットの一覧は [環境変数一覧](15_env-vars.md) も参照。

---

### STEP 6: Workload Identity Federation の設定

GitHub Actions からサービスアカウントキーなしで GCP に認証するための設定。

```bash
# Workload Identity Pool を作成
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --display-name="GitHub Actions Pool" \
  --project=$PROJECT_ID

# GitHub 用プロバイダーを作成
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --workload-identity-pool=github-pool \
  --location=global \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='sinsuke1027-lab/Task-flow'" \
  --project=$PROJECT_ID

# プロバイダーのリソース名を取得（GitHub Secrets に登録する値）
gcloud iam workload-identity-pools providers describe github-provider \
  --workload-identity-pool=github-pool \
  --location=global \
  --project=$PROJECT_ID \
  --format="value(name)"
# → projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-pool/providers/github-provider

# サービスアカウントに Workload Identity からの権限借用を許可
POOL_NAME=$(gcloud iam workload-identity-pools describe github-pool \
  --location=global --project=$PROJECT_ID --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository/sinsuke1027-lab/Task-flow" \
  --project=$PROJECT_ID
```

---

### STEP 7: GitHub Secrets の設定

GitHub リポジトリ（`sinsuke1027-lab/Task-flow`）の Settings > Secrets and variables > Actions に以下を登録する。

| シークレット名 | 値 | 取得元 |
|--------------|-----|--------|
| `GCP_PROJECT_ID` | GCP プロジェクト ID（例: `my-taskflow-prod`） | GCP Console |
| `WIF_PROVIDER` | Workload Identity プロバイダーのリソース名（STEP 6 で取得） | STEP 6 の出力 |
| `WIF_SERVICE_ACCOUNT` | デプロイ用 SA のメール（例: `deploy-sa@my-taskflow-prod.iam.gserviceaccount.com`） | STEP 4 |

---

### STEP 8: 初回デプロイの実行

master ブランチに push すると `deploy.yml` が自動で実行されます。

手動で実行する場合:

```bash
gcloud builds submit \
  --project=$PROJECT_ID \
  --config=cloudbuild.yaml \
  --substitutions=COMMIT_SHA=manual-deploy
```

---

### STEP 9: Cloud Run URL の取得と Supabase への登録

```bash
# デプロイ後に Cloud Run の URL を取得
gcloud run services describe task-flow \
  --region=asia-northeast1 \
  --project=$PROJECT_ID \
  --format="value(status.url)"
```

取得した URL を Supabase Dashboard で設定する（GCP-B4）:

- Authentication > URL Configuration > **Site URL**: `https://<cloud-run-url>`
- Authentication > URL Configuration > **Redirect URLs**: `https://<cloud-run-url>/auth/callback`

---

## 4. 動作確認チェックリスト

デプロイ後に以下を確認してください。

```bash
CLOUD_RUN_URL=$(gcloud run services describe task-flow \
  --region=asia-northeast1 --project=$PROJECT_ID --format="value(status.url)")

# ヘルスチェック（200 OK と {"status":"ok"} が返ること）
curl -s "$CLOUD_RUN_URL/api/health"

# トップページが返ること（302 リダイレクト → /login が正常）
curl -sI "$CLOUD_RUN_URL/"
```

| チェック項目 | 期待値 |
|------------|--------|
| `/api/health` のレスポンス | `{"status":"ok","timestamp":"..."}` |
| `/` へのアクセス | `/login` へ 302 リダイレクト |
| ログイン画面の表示 | Supabase Auth のメール入力画面が表示される |
| ログイン成功後 | ダッシュボードに遷移する |
| 申請フォームの送信 | Supabase DB にタスクが登録される |
| 管理者以外の `/admin` アクセス | トップページへリダイレクトされる |

---

## 5. ローカルで Docker をテストする

```bash
# ビルド
docker build -t taskflow-local .

# モックモードで起動（DB不要）
docker run -p 3000:8080 taskflow-local

# Supabase モードで起動
docker run -p 3000:8080 \
  -e NEXT_PUBLIC_DATA_PROVIDER=supabase \
  -e NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
  taskflow-local
```

---

## 6. トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| Cloud Run でコンテナが起動しない | `PORT=8080` が未設定 | `Dockerfile` の `ENV PORT=8080` を確認 |
| `next build` でスタンドアロン出力されない | `output: 'standalone'` が未設定 | `next.config.ts` の `nextConfig.output` を確認 |
| Supabase に接続できない | シークレットの値が誤り | `gcloud secrets versions access latest --secret=NEXT_PUBLIC_SUPABASE_URL` で値を確認 |
| Cold Start が遅い | `min-instances=0` になっている | `cloudbuild.yaml` の `--min-instances=1` を確認 |
| GitHub Actions で認証エラー | WIF の設定ミス | `WIF_PROVIDER` / `WIF_SERVICE_ACCOUNT` の値を再確認。`attribute-condition` のリポジトリ名が正しいか確認 |
| `/login` に無限リダイレクト | Supabase URL / Key が未設定 | Cloud Run の環境変数（Secret Manager）を確認 |

---

## 7. 継続整備（運用安定後）

| タスク | 内容 |
|--------|------|
| Cloud Monitoring アラート | エラーレート・レイテンシ > 3秒のアラートを GCP Console で設定 |
| Supabase Pro 移行 | 数百人規模になったら Tokyo リージョンの Pro プランへ移行（接続数無制限・自動停止なし） |
| GitHub Actions の deploy.yml 微調整 | 現状は master push 全体でトリガー。必要に応じてパスフィルターを追加 |
