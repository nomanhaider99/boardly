import { Flag } from "lucide-react";
import type { CardLabel } from "@/db/schema";

// Simple luminance check so text stays readable on any label color.
function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // relative luminance
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.65;
}

export function LabelPill({
  label,
  size = "md",
}: {
  label: Pick<CardLabel, "title" | "color" | "type">;
  size?: "sm" | "md";
}) {
  const light = isLight(label.color);
  const sm = size === "sm";
  return (
    <span
      style={{ backgroundColor: label.color, color: light ? "#111827" : "#ffffff" }}
      className={`inline-flex items-center rounded-full font-semibold leading-none ${
        sm ? "gap-0.5 px-1.5 py-0.5 text-[10px]" : "gap-1 px-2 py-0.5 text-xs"
      }`}
      title={label.type === "priority" ? `Priority: ${label.title}` : label.title}
    >
      {label.type === "priority" && (
        <Flag className={sm ? "h-2.5 w-2.5" : "h-3 w-3"} fill="currentColor" />
      )}
      {label.title}
    </span>
  );
}
