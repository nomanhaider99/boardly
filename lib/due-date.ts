export type Urgency = "overdue" | "urgent" | "upcoming" | "normal" | "none";

const H = 60 * 60 * 1000;
const D = 24 * H;

export function getUrgency(dueDate: Date | null | undefined): Urgency {
  if (!dueDate) return "none";
  const diff = dueDate.getTime() - Date.now();
  if (diff < 0) return "overdue";
  if (diff < D) return "urgent";
  if (diff < 7 * D) return "upcoming";
  return "normal";
}

export const urgencyConfig: Record<
  Urgency,
  { label: string; pill: string }
> = {
  overdue:  { label: "Overdue",  pill: "bg-destructive/10 text-destructive border border-destructive/20" },
  urgent:   { label: "Due soon", pill: "bg-orange-500/10 text-orange-500 border border-orange-500/20" },
  upcoming: { label: "Upcoming", pill: "bg-amber-500/10 text-amber-600 border border-amber-500/20" },
  normal:   { label: "On track", pill: "bg-primary/10 text-primary border border-primary/20" },
  none:     { label: "",         pill: "" },
};
