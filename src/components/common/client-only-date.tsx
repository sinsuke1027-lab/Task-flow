'use client';

interface ClientOnlyDateProps {
  date: string | Date;
  className?: string;
  showTime?: boolean;
}

export function ClientOnlyDate({ date, className, showTime = false }: ClientOnlyDateProps) {
  const dateObj = new Date(date);

  if (isNaN(dateObj.getTime())) {
    return <span className={className}>--/--/--</span>;
  }

  if (showTime) {
    return (
      <span className={className} suppressHydrationWarning>
        {dateObj.toLocaleDateString('ja-JP')} {dateObj.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
      </span>
    );
  }

  return <span className={className} suppressHydrationWarning>{dateObj.toLocaleDateString('ja-JP')}</span>;
}
