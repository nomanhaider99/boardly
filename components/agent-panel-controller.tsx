"use client";

import { useState, useEffect } from "react";
import { AgentPanel } from "@/components/agent-panel";
import type { ModelProvider } from "@/lib/ai-provider";

const STORAGE_KEY = "boardly:agent:provider";

function readStoredProvider(): ModelProvider {
  if (typeof window === "undefined") return "mistral";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "claude" || stored === "gemini" || stored === "mistral") return stored;
  return "mistral";
}

type Props = { boardId: string; currentUserName: string };

export function AgentPanelController({ boardId, currentUserName }: Props) {
  const [open, setOpen] = useState(false);
  const [modelProvider, setModelProvider] = useState<ModelProvider>("mistral");

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setModelProvider(readStoredProvider());
  }, []);

  function handleProviderChange(p: ModelProvider) {
    setModelProvider(p);
    localStorage.setItem(STORAGE_KEY, p);
  }

  return (
    <AgentPanel
      key={modelProvider} // remounts useChat when provider changes, clearing history
      boardId={boardId}
      currentUserName={currentUserName}
      modelProvider={modelProvider}
      onProviderChange={handleProviderChange}
      open={open}
      onOpenChange={setOpen}
    />
  );
}
