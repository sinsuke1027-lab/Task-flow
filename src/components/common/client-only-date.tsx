'use client';

import { useEffect, useState } from 'react';

interface ClientOnlyDateProps {
  date: string | Date;
  className?: string;
  showTime?: boolean;
}

/**
 * サーバーサイドとクライアントサイドでのロケール差分による
 * ハイドレーション・ミスマッチを防ぐためのコンポーネント。
 */
export function ClientOnlyDate({ date, className, showTime = false }: ClientOnlyDateProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // サーバーサイドおよびハイドレーション前はプレースホルダー（または空）を返す
    return <span className={className}>--/--/--</span>;
  }

  const dateObj = new Date(date);
  
  if (showTime) {
    return (
      <span className={className}>
        {dateObj.toLocaleDateString('ja-JP')} {dateObj.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
      </span>
    );
  }

  return <span className={className}>{dateObj.toLocaleDateString('ja-JP')}</span>;
}
