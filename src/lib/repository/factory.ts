import { DataProvider } from './types';
import { mockProvider } from './mock-provider';

// アクティブな DataProvider をモジュールスコープで保持する
// setDataProvider() で実DB（Supabase など）への切り替えが可能
let _provider: DataProvider = mockProvider;

/**
 * 現在アクティブな DataProvider を返す。
 * アプリケーション全体でこの関数を通してプロバイダーを取得すること。
 */
export function getDataProvider(): DataProvider {
  return _provider;
}

/**
 * DataProvider を差し替える。
 * 実DB への移行時や、テスト環境でのモック注入時に使用する。
 *
 * 例:
 *   import { setDataProvider } from '@/lib/repository/factory';
 *   import { SupabaseProvider } from '@/lib/repository/supabase-provider';
 *   setDataProvider(new SupabaseProvider());
 */
export function setDataProvider(provider: DataProvider): void {
  _provider = provider;
}
