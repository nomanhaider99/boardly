export default function SettingsLoading() {
  return (
    <main className="flex-1 p-6 sm:p-8 max-w-2xl space-y-10">
      <div className="h-7 w-52 rounded-lg bg-muted animate-pulse" />

      <section className="space-y-3">
        <div className="h-3 w-24 rounded bg-muted animate-pulse" />
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-2 animate-pulse">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-32 rounded bg-muted" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="h-3 w-28 rounded bg-muted animate-pulse" />
        <div className="rounded-2xl border border-border/50 bg-card p-5 animate-pulse">
          <div className="flex gap-2">
            <div className="h-9 flex-1 rounded-lg bg-muted" />
            <div className="h-9 w-24 rounded-lg bg-muted" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="h-3 w-32 rounded bg-muted animate-pulse" />
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0">
              <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-36 rounded bg-muted" />
                <div className="h-3 w-48 rounded bg-muted" />
              </div>
              <div className="h-4 w-16 rounded bg-muted shrink-0" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
