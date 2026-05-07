export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-6 animate-pulse">
      {/* ページヘッダースケルトン */}
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 rounded-md bg-muted" />
        <div className="h-4 w-72 rounded-md bg-muted" />
      </div>

      {/* カードグリッドスケルトン */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-background"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 rounded-md bg-muted" />
              <div className="h-6 w-16 rounded-full bg-muted" />
            </div>
            <div className="h-4 w-full rounded-md bg-muted" />
            <div className="h-4 w-3/4 rounded-md bg-muted" />
            <div className="flex items-center gap-2 mt-2">
              <div className="h-6 w-6 rounded-full bg-muted" />
              <div className="h-3 w-20 rounded-md bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
