import { DataProvider } from './types';
import { mockProvider } from './mock-provider';
import { supabase } from '../supabase/client';
import { SupabaseDataProvider } from './supabase-provider';

let _provider: DataProvider | null = null;

export function getDataProvider(): DataProvider {
  if (!_provider) {
    _provider =
      process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase' && supabase
        ? new SupabaseDataProvider(supabase)
        : mockProvider;
  }
  return _provider;
}

/**
 * DataProvider を差し替える。
 * Supabase 移行時: setDataProvider(new SupabaseDataProvider(supabase))
 * テスト時: setDataProvider(mockProvider)
 */
export function setDataProvider(provider: DataProvider): void {
  _provider = provider;
}
