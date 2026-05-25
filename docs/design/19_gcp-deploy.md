# GCPデプロイガイド — TaskFlow

| 項目 | 内容 |
|------|------|
| システム名 | TaskFlow |
| 作成日 | 2026-05-14 |
| 最終更新 | 2026-05-26 |
| 参照ファイル | `Dockerfile`, `cloudbuild.yaml`, `.github/workflows/deploy.yml` |

---

## 1. アーキテクチャ概要

```
GitHub (master ブランチへ push)
    ↓ GitHub Actions (deploy.yml) — Workload Identity Federation で認証
Cloud Build
    ↓ Docker ビルド → Artifact Registry プッシュ → Cloud Run デプロイ
Cloud Run (asia-northeast1)
  - min-instances: 1 / max-instances: 10 / メモリ: 512Mi
    ↓ 環境変数は Secret Manager から注入
Supabase (DB / Auth)
  - PostgreSQL（全テーブルに tenant_id、RLS 適用済み）
  - Supabase Auth（メール＋パスワード）
```

---

## 2. コードリポジトリ側の準備状況（実装済み・変更不要）

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

## 3. 作業全体の進捗チェックリスト

途中から再開する場合は、このリストで完了済みのSTEPを確認してから始めてください。

| STEP | 内容 | 完了 |
|------|------|------|
| STEP 1 | Supabase プロジェクト作成・マイグレーション適用 | ☐ |
| STEP 2 | GCP API の有効化 | ☐ |
| STEP 3 | Artifact Registry リポジトリ作成 | ☐ |
| STEP 4 | サービスアカウント作成・IAM 設定 | ☐ |
| STEP 5 | Secret Manager にシークレット登録 | ☐ |
| STEP 6 | Workload Identity Federation 設定 | ☐ |
| STEP 7 | GitHub Secrets 登録 | ☐ |
| STEP 8 | 初回デプロイ実行 | ☐ |
| STEP 9 | Cloud Run URL を Supabase に登録 | ☐ |

---

## 4. 変数の定義（途中から始める場合も毎回実行）

**どのSTEPから始める場合も、最初にこのブロックを実行してください。**

```bash
# ── 必須 ──────────────────────────────────────────────────────────────
PROJECT_ID=your-gcp-project-id          # 例: taskflow-prod-2026
SA_EMAIL="deploy-sa@${PROJECT_ID}.iam.gserviceaccount.com"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)' 2>/dev/null)

# ── 確認 ──────────────────────────────────────────────────────────────
echo "PROJECT_ID    : $PROJECT_ID"
echo "SA_EMAIL      : $SA_EMAIL"
echo "PROJECT_NUMBER: $PROJECT_NUMBER"
```

---

## 5. GCP 担当者が行う作業

---

### STEP 1: Supabase プロジェクトの作成

詳細は [DBマイグレーション手順書](18_db-migration.md) を参照。

**完了確認:**

Supabase Dashboard > SQL Editor で以下を実行し、9テーブルがすべて表示されれば完了。

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
-- 期待値: audit_logs, categories, delegations, departments,
--         organization_units, statuses, tasks, user_change_events, users
```

**手順（未実施の場合）:**

1. [Supabase Dashboard](https://app.supabase.com) でプロジェクトを新規作成
   - リージョン: US East（試験運用）/ Tokyo（本番）
2. SQL Editor で `supabase/migrations/001_initial_schema.sql` の内容を貼り付けて実行
3. SQL Editor で `supabase/migrations/002_rls_policies.sql` の内容を貼り付けて実行
4. Settings > API から以下をメモしておく（STEP 5 で使用）
   - **Project URL**（例: `https://xxxx.supabase.co`）
   - **anon public key**（例: `eyJhbGc...`）
5. Authentication > Settings で Email 認証を有効化（パスワード最低12文字を推奨）

---

### STEP 2: GCP API の有効化

**完了確認（スキップ判断）:**

```bash
gcloud services list --enabled --filter="name:(run.googleapis.com OR artifactregistry.googleapis.com OR cloudbuild.googleapis.com OR secretmanager.googleapis.com OR iamcredentials.googleapis.com)" --project=$PROJECT_ID --format="value(name)"
# 5件すべて表示されれば STEP 2 は完了
```

**手順（未実施の場合）:**

```bash
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

**完了確認（スキップ判断）:**

```bash
gcloud artifacts repositories describe task-flow \
  --location=asia-northeast1 --project=$PROJECT_ID 2>/dev/null \
  && echo "✅ 作成済み" || echo "⬜ 未作成"
```

**手順（未実施の場合）:**

```bash
gcloud artifacts repositories create task-flow \
  --repository-format=docker \
  --location=asia-northeast1 \
  --project=$PROJECT_ID
```

---

### STEP 4: サービスアカウントと IAM 設定

**完了確認（スキップ判断）:**

```bash
gcloud iam service-accounts describe $SA_EMAIL --project=$PROJECT_ID 2>/dev/null \
  && echo "✅ SA 作成済み" || echo "⬜ SA 未作成"

gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${SA_EMAIL}" \
  --format="table(bindings.role)"
# roles/run.admin, roles/artifactregistry.writer,
# roles/secretmanager.secretAccessor, roles/cloudbuild.builds.builder が表示されれば完了
```

**手順（未実施の場合）:**

```bash
# 4-1: サービスアカウントの作成
gcloud iam service-accounts create deploy-sa \
  --display-name="TaskFlow Deploy Service Account" \
  --project=$PROJECT_ID

# 4-2: IAM ロールを付与
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudbuild.builds.builder"

# Cloud Run の実行サービスアカウントに Secret Manager 読み取り権限を付与
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

### STEP 5: Secret Manager にシークレットを登録

**完了確認（スキップ判断）:**

```bash
for SECRET in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY NEXT_PUBLIC_DATA_PROVIDER; do
  gcloud secrets describe $SECRET --project=$PROJECT_ID 2>/dev/null \
    && echo "✅ $SECRET" || echo "⬜ $SECRET"
done
```

**手順（未実施の場合）:**

`xxxx` の部分は STEP 1 でメモした実際の値に置き換えてください。

```bash
# Supabase URL
echo -n "https://xxxx.supabase.co" | \
  gcloud secrets create NEXT_PUBLIC_SUPABASE_URL --data-file=- --project=$PROJECT_ID

# Supabase anon key
echo -n "eyJhbGc..." | \
  gcloud secrets create NEXT_PUBLIC_SUPABASE_ANON_KEY --data-file=- --project=$PROJECT_ID

# データプロバイダー（固定値）
echo -n "supabase" | \
  gcloud secrets create NEXT_PUBLIC_DATA_PROVIDER --data-file=- --project=$PROJECT_ID
```

**値を更新したい場合（シークレットが既に存在するとき）:**

```bash
echo -n "新しい値" | \
  gcloud secrets versions add NEXT_PUBLIC_SUPABASE_URL --data-file=- --project=$PROJECT_ID
```

---

### STEP 6: Workload Identity Federation の設定

**完了確認（スキップ判断）:**

```bash
gcloud iam workload-identity-pools describe github-pool \
  --location=global --project=$PROJECT_ID 2>/dev/null \
  && echo "✅ Pool 作成済み" || echo "⬜ Pool 未作成"

gcloud iam workload-identity-pools providers describe github-provider \
  --workload-identity-pool=github-pool \
  --location=global --project=$PROJECT_ID 2>/dev/null \
  && echo "✅ Provider 作成済み" || echo "⬜ Provider 未作成"
```

**手順（未実施の場合）:**

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

# サービスアカウントへの権限借用を許可
POOL_NAME=$(gcloud iam workload-identity-pools describe github-pool \
  --location=global --project=$PROJECT_ID --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository/sinsuke1027-lab/Task-flow" \
  --project=$PROJECT_ID
```

**STEP 7 に必要な値を取得:**

```bash
# WIF_PROVIDER の値（GitHub Secrets に登録する）
gcloud iam workload-identity-pools providers describe github-provider \
  --workload-identity-pool=github-pool \
  --location=global \
  --project=$PROJECT_ID \
  --format="value(name)"
# 出力例: projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider

# WIF_SERVICE_ACCOUNT の値（= $SA_EMAIL）
echo $SA_EMAIL
# 出力例: deploy-sa@your-gcp-project-id.iam.gserviceaccount.com
```

---

### STEP 7: GitHub Secrets の設定

GitHub リポジトリ（`sinsuke1027-lab/Task-flow`）の
**Settings > Secrets and variables > Actions > New repository secret** で以下を登録する。

| シークレット名 | 値 | 取得元 |
|--------------|-----|--------|
| `GCP_PROJECT_ID` | GCP プロジェクト ID（例: `taskflow-prod-2026`） | 変数定義の `$PROJECT_ID` |
| `WIF_PROVIDER` | Workload Identity プロバイダーのリソース名 | STEP 6 の 1つ目の出力 |
| `WIF_SERVICE_ACCOUNT` | デプロイ用 SA のメール | STEP 6 の 2つ目の出力（`$SA_EMAIL`） |

**完了確認（スキップ判断）:**

GitHub CLI が使える場合:
```bash
gh secret list --repo sinsuke1027-lab/Task-flow
# GCP_PROJECT_ID, WIF_PROVIDER, WIF_SERVICE_ACCOUNT の3件が表示されれば完了
```

---

### STEP 8: 初回デプロイの実行

master ブランチに push すると `deploy.yml` が自動で実行されます。

**手動でデプロイする場合（リポジトリのルートで実行）:**

```bash
gcloud builds submit \
  --project=$PROJECT_ID \
  --config=cloudbuild.yaml \
  --substitutions=COMMIT_SHA=manual-deploy
```

**デプロイの進捗確認:**

```bash
gcloud builds list --project=$PROJECT_ID --limit=3
```

---

### STEP 9: Cloud Run URL の取得と Supabase への登録

**URL の取得:**

```bash
gcloud run services describe task-flow \
  --region=asia-northeast1 \
  --project=$PROJECT_ID \
  --format="value(status.url)"
# 出力例: https://task-flow-xxxxxxxxxx-an.a.run.app
```

**Supabase Dashboard で設定（GCP-B4）:**

Authentication > URL Configuration を開き以下を設定する。

| 設定項目 | 値 |
|---------|-----|
| Site URL | `https://<cloud-run-url>` |
| Redirect URLs | `https://<cloud-run-url>/auth/callback` |

---

## 6. 動作確認チェックリスト

デプロイ後に以下をすべて確認してください。

```bash
CLOUD_RUN_URL=$(gcloud run services describe task-flow \
  --region=asia-northeast1 --project=$PROJECT_ID --format="value(status.url)")

# ヘルスチェック
curl -s "$CLOUD_RUN_URL/api/health"
# 期待値: {"status":"ok","timestamp":"..."}

# トップページ（ログイン未認証で /login へリダイレクト）
curl -sI "$CLOUD_RUN_URL/" | head -5
# 期待値: HTTP/2 302, location: .../login
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

## 7. ローカルで Docker をテストする

```bash
# ビルド
docker build -t taskflow-local .

# モックモードで起動（Supabase 不要）
docker run -p 3000:8080 taskflow-local

# Supabase モードで起動
docker run -p 3000:8080 \
  -e NEXT_PUBLIC_DATA_PROVIDER=supabase \
  -e NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
  taskflow-local
```

---

## 8. トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| Cloud Run でコンテナが起動しない | `PORT=8080` が未設定 | `Dockerfile` の `ENV PORT=8080` を確認 |
| `next build` でスタンドアロン出力されない | `output: 'standalone'` が未設定 | `next.config.ts` の `nextConfig.output` を確認 |
| Supabase に接続できない | シークレットの値が誤り | `gcloud secrets versions access latest --secret=NEXT_PUBLIC_SUPABASE_URL --project=$PROJECT_ID` で値を確認 |
| Cold Start が遅い | `min-instances=0` になっている | `cloudbuild.yaml` の `--min-instances=1` を確認 |
| GitHub Actions で認証エラー | WIF の設定ミス | `WIF_PROVIDER` / `WIF_SERVICE_ACCOUNT` の値を再確認。`attribute-condition` のリポジトリ名が正しいか確認 |
| `/login` に無限リダイレクト | Supabase URL / Key が未設定 | Secret Manager のシークレット値と Cloud Run の `--update-secrets` 設定を確認 |
| `gcloud secrets create` でエラー | シークレットが既に存在する | `gcloud secrets versions add` で値を更新する（STEP 5 参照） |
| `gcloud iam workload-identity-pools create` でエラー | Pool が既に存在する | STEP 6 の完了確認コマンドで存在を確認し、存在していれば STEP 6 はスキップ |

---

## 9. 継続整備（運用安定後）

| タスク | 内容 |
|--------|------|
| Cloud Monitoring アラート | エラーレート・レイテンシ > 3秒のアラートを GCP Console で設定 |
| Supabase Pro 移行 | 数百人規模になったら Tokyo リージョンの Pro プランへ移行（接続数無制限・自動停止なし） |
