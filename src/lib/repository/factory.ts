import { DataProvider } from './types';
import { mockProvider } from './mock-provider';

let _provider: DataProvider = mockProvider;

export function getDataProvider(): DataProvider {
  return _provider;
}

/**
 * DataProvider を差し替える。
 * Supabase 移行時: setDataProvider(new SupabaseProvider(supabase))
 * テスト時: setDataProvider(mockProvider)
 */
export function setDataProvider(provider: DataProvider): void {
  _provider = provider;
}
