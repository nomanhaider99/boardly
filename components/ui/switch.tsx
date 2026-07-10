"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends React.ComponentPropsWithoutRef<"button"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

function Switch({ className, checked, onCheckedChange, ...props }: SwitchProps) {
  const handleClick = () => {
    if (onCheckedChange) {
      onCheckedChange(!checked);
    }
  };

  return (
    <button
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        className
      )}
      role="switch"
      aria-checked={checked}
      onClick={handleClick}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 shrink-0 rounded-full bg-background shadow-lg ring-0 transition-transform",
          "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      />
    </button>
  );
}
Switch.displayName = "Switch";

export { Switch };