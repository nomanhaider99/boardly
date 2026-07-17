// Shared label constants (client + server safe — not a "use server" module).

// Built-in priority labels, seeded on every new board.
export const PRIORITY_LABELS: { title: string; color: string }[] = [
  { title: "No Rush", color: "#64748b" },
  { title: "Normal", color: "#3b82f6" },
  { title: "Urgent", color: "#f59e0b" },
  { title: "Critical", color: "#ef4444" },
];

// Palette offered when creating custom labels.
export const LABEL_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#64748b",
];
