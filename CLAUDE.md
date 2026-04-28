@AGENTS.md

# TaskFlow

申請・承認ワークフロー管理アプリ。Next.js 16 + React 19 + TypeScript。

## ディレクトリ構造

```
src/
  app/          # Next.js App Router ページ
  components/   # UIコンポーネント
  context/      # React Context (auth, sidebar)
  hooks/        # カスタムフック
  lib/
    repository/ # データプロバイダー抽象化（types.ts, factory.ts, mock-provider.ts）
    export/     # CSV/JSONエクスポート
    workflow-utils.ts  # 承認ルート解決ロジック
  mocks/        # モックJSON（tasks.json, categories.json）
```

## 技術スタック

- Next.js 16.2.2 / React 19.2.4
- TypeScript 5 / Tailwind CSS 4
- ESLint（React Compiler rules 適用）
- モックデータのみ（DB未接続）

## スクリプト

```bash
npm run dev        # 開発サーバー
npm run typecheck  # 型チェック（tsc --noEmit）
npm run lint       # ESLint
npm run build      # プロダクションビルド
```
