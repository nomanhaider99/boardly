export default function WorkspaceLoading() {
  return (
    <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
      <div className="max-w-5xl">
        <div className="mb-8 space-y-2">
          <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-20 rounded bg-muted animate-pulse" />
          <div className="h-8 w-24 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/50 bg-card p-4 min-h-[90px] animate-pulse space-y-2"
            >
              <div className="h-5 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/3 rounded bg-muted mt-auto" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
