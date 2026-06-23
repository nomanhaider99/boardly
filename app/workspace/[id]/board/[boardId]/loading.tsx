export default function BoardLoading() {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border/40 bg-background/80 backdrop-blur-md px-5 py-3 shrink-0">
        <div className="h-6 w-36 rounded-md bg-muted animate-pulse" />
        <span className="text-muted-foreground text-xs">/</span>
        <div className="h-4 w-24 rounded-md bg-muted animate-pulse" />
      </header>
      <div className="flex-1 overflow-hidden p-4">
        <div className="flex gap-3 items-start h-full">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-64 shrink-0 rounded-xl border border-border/50 bg-card p-3 space-y-2 animate-pulse"
            >
              <div className="h-5 w-28 rounded bg-muted" />
              {[...Array(i + 2)].map((_, j) => (
                <div
                  key={j}
                  className="rounded-lg border border-border/30 bg-background px-3 py-2.5 space-y-1.5"
                >
                  <div className="h-4 w-full rounded bg-muted" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
