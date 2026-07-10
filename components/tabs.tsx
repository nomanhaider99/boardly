"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Tab = {
  id: string;
  label: string;
  icon: React.ReactNode;
  content: React.ReactNode;
};

export function Tabs({ tabs, activeTab, onTabChange }: {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-border/40">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex h-10 items-center gap-2 rounded-t-lg px-4 text-sm font-medium transition-colors",
              "border-b-2 border-transparent -mb-px",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tabs.find((t) => t.id === activeTab)?.content}
      </div>
    </div>
  );
}