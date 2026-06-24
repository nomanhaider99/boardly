export function WorkspaceCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden animate-pulse">
      {/* Gradient header placeholder */}
      <div className="h-28 bg-muted/60" />
      {/* Body */}
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
  );
}

export function WorkspaceGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <WorkspaceCardSkeleton key={i} />
      ))}
    </div>
  );
}
