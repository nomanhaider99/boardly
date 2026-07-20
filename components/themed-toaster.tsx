"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/**
 * App-themed Sonner toaster. Cards use the same tokens (card / border /
 * foreground) and fonts (Bricolage heading for titles, Manrope body for
 * descriptions) as the rest of the UI, with a coloured left accent + icon
 * per toast type.
 */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="top-right"
      theme={(resolvedTheme as "light" | "dark") ?? "dark"}
      gap={10}
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "group items-start gap-3! rounded-xl! border! border-border/70! bg-card/95! text-card-foreground! p-4! shadow-lg! backdrop-blur-sm! font-sans!",
          title: "font-heading! font-semibold! text-[13px]! leading-tight! text-foreground!",
          description: "text-muted-foreground! text-xs! leading-relaxed! mt-0.5!",
          icon: "mt-0.5! [&>svg]:h-[18px]! [&>svg]:w-[18px]!",
          closeButton:
            "bg-card! border-border! text-muted-foreground! hover:text-foreground! hover:bg-muted!",
          actionButton:
            "bg-primary! text-primary-foreground! rounded-lg! text-xs! font-semibold! px-2.5! py-1.5!",
          cancelButton:
            "bg-muted! text-muted-foreground! rounded-lg! text-xs! font-medium! px-2.5! py-1.5!",
          success: "border-l-4! border-l-emerald-500! [&_[data-icon]>svg]:text-emerald-500!",
          error: "border-l-4! border-l-destructive! [&_[data-icon]>svg]:text-destructive!",
          warning: "border-l-4! border-l-amber-500! [&_[data-icon]>svg]:text-amber-500!",
          info: "border-l-4! border-l-primary! [&_[data-icon]>svg]:text-primary!",
        },
      }}
    />
  );
}
