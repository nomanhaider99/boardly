export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navbar skeleton */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="h-6 w-24 rounded bg-muted animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
            <div className="h-8 w-24 rounded-lg bg-muted animate-pulse" />
            <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
          </div>
        </div>
      </header>

      {/* Hero skeleton */}
      <div className="border-b border-border/40 bg-gradient-to-br from-primary/8 via-background to-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-48 rounded-lg bg-muted animate-pulse" />
              <div className="h-4 w-64 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between mb-7">
          <div className="space-y-1.5">
            <div className="h-5 w-32 rounded-lg bg-muted animate-pulse" />
            <div className="h-3 w-44 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-9 w-36 rounded-lg bg-muted animate-pulse" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/50 bg-card overflow-hidden animate-pulse">
              <div className="h-28 bg-muted/60" />
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="h-4 w-36 rounded bg-muted" />
                  <div className="h-4 w-14 rounded-full bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-3/4 rounded bg-muted" />
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <div className="h-3 w-28 rounded bg-muted" />
                  <div className="h-3 w-12 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
