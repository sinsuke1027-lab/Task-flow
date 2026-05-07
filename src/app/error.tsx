'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="flex flex-col items-center gap-4 max-w-md">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-50">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-foreground">
            エラーが発生しました
          </h2>
          <p className="text-sm text-muted-foreground">
            {process.env.NODE_ENV === 'development'
              ? (error.message || 'ページの読み込み中に問題が発生しました。')
              : 'ページの読み込み中に問題が発生しました。'}
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono mt-1">
              エラーID: {error.digest}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={unstable_retry}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <RotateCcw className="w-4 h-4" />
          再試行
        </button>
      </div>
    </div>
  );
}
