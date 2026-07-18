// Curated default board backgrounds. Values are full CSS `background` values
// (gradients) so they are self-contained — no external image hosting required.

export type BoardBackground = {
  key: string;
  label: string;
  value: string;
};

export const BOARD_BACKGROUNDS: BoardBackground[] = [
  { key: "photo", label: "Photo", value: "/background.webp" },
  { key: "emerald", label: "Emerald", value: "linear-gradient(135deg, #059669 0%, #10b981 100%)" },
  { key: "ocean", label: "Ocean", value: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)" },
  { key: "sunset", label: "Sunset", value: "linear-gradient(135deg, #f97316 0%, #f43f5e 100%)" },
  { key: "violet", label: "Violet", value: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)" },
  { key: "midnight", label: "Midnight", value: "linear-gradient(135deg, #334155 0%, #0f172a 100%)" },
  { key: "bloom", label: "Bloom", value: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)" },
  { key: "forest", label: "Forest", value: "linear-gradient(135deg, #166534 0%, #4d7c0f 100%)" },
];

// Pick a default background for a newly created board.
export function pickDefaultBackground(): string {
  const i = Math.floor(Math.random() * BOARD_BACKGROUNDS.length);
  return BOARD_BACKGROUNDS[i].value;
}

// Normalize a stored background value into a CSS `background` string.
// Gradient strings are used as-is; anything else (local path like
// "/background.webp" or a remote URL) is treated as a cover image.
export function resolveBackground(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (/gradient\(/i.test(value)) return value;
  return `center / cover no-repeat url("${value}")`;
}
