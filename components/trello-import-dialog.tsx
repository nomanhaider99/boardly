"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight, X, Loader2, Check, RefreshCw,
  LayoutList, Unplug, ChevronRight, AlertCircle, ExternalLink,
  Upload, FileJson,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "api" | "json";
type ApiStep = "connect" | "select";
type JsonStep = "upload" | "preview";
type GlobalStep = "main" | "importing" | "done";

type TrelloBoard = { id: string; name: string; shortUrl: string };
type TrelloListPreview = { id: string; name: string; cardCount: number };
type BoardPreview = {
  id: string; name: string; lists: TrelloListPreview[];
  totalCards: number; totalComments: number; totalAttachments: number;
};
type ImportResult = { lists: number; cards: number; comments: number; attachments: number };

// Minimal extracted shape from Trello JSON export
type JsonCard = {
  id: string; idList: string; name: string; desc: string;
  due: string | null; pos: number;
  cover?: { scaled?: { url: string; height: number }[] } | null;
  attachments?: { name: string; url: string; mimeType: string; bytes: number }[];
};
type JsonAction = {
  date: string;
  data: { text: string; card: { id: string } };
  memberCreator: { fullName: string };
};
type JsonPreview = {
  boardName: string;
  lists: { id: string; name: string; pos: number; cardCount: number }[];
  totalCards: number; totalComments: number; totalAttachments: number;
};
type ExtractedPayload = {
  lists: { id: string; name: string; pos: number }[];
  cards: JsonCard[];
  actions: JsonAction[];
};

// ── Trello logo ────────────────────────────────────────────────────────────────

function TrelloLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect width="24" height="24" rx="4" fill="#0052CC" />
      <rect x="5" y="5" width="5.5" height="13" rx="1.5" fill="white" />
      <rect x="13.5" y="5" width="5.5" height="8.5" rx="1.5" fill="white" />
    </svg>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  boardId: string;
  boardName: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function TrelloImportDialog({ boardId, boardName }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Mode / step
  const [mode, setMode] = useState<Mode>("api");
  const [apiStep, setApiStep] = useState<ApiStep>("connect");
  const [jsonStep, setJsonStep] = useState<JsonStep>("upload");
  const [globalStep, setGlobalStep] = useState<GlobalStep>("main");

  // API state
  const [apiKey, setApiKey] = useState("");
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [trelloBoards, setTrelloBoards] = useState<TrelloBoard[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [preview, setPreview] = useState<BoardPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importError, setImportError] = useState("");

  // JSON state
  const [jsonDragging, setJsonDragging] = useState(false);
  const [jsonParsing, setJsonParsing] = useState(false);
  const [jsonParseError, setJsonParseError] = useState("");
  const [jsonPreview, setJsonPreview] = useState<JsonPreview | null>(null);
  const [jsonPayload, setJsonPayload] = useState<ExtractedPayload | null>(null);
  const [jsonFileName, setJsonFileName] = useState("");
  const [jsonImportError, setJsonImportError] = useState("");

  // Shared result
  const [result, setResult] = useState<ImportResult | null>(null);

  const apiKeyRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    checkConnectionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (mode === "api" && apiStep === "connect" && globalStep === "main")
      setTimeout(() => apiKeyRef.current?.focus(), 80);
    if (mode === "api" && apiStep === "select" && globalStep === "main")
      loadBoards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, apiStep, globalStep]);

  useEffect(() => {
    if (!selectedBoardId) { setPreview(null); return; }
    loadPreview(selectedBoardId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBoardId]);

  // ── API helpers ───────────────────────────────────────────────────────────────

  async function checkConnectionStatus() {
    try {
      const r = await fetch("/api/trello/credentials");
      if (!r.ok) return;
      const d: { connected: boolean } = await r.json();
      setApiStep(d.connected ? "select" : "connect");
    } catch { /* show connect by default */ }
  }

  async function loadBoards() {
    setLoadingBoards(true);
    setSelectedBoardId(null);
    setPreview(null);
    try {
      const r = await fetch("/api/trello/boards");
      if (!r.ok) { toast.error("Failed to load Trello boards"); return; }
      const d: { boards: TrelloBoard[] } = await r.json();
      setTrelloBoards(d.boards);
    } catch { toast.error("Network error loading boards"); }
    finally { setLoadingBoards(false); }
  }

  async function loadPreview(trelloBoardId: string) {
    setLoadingPreview(true);
    setPreview(null);
    try {
      const r = await fetch(`/api/trello/boards/${trelloBoardId}`);
      if (!r.ok) return;
      const d: { board: BoardPreview } = await r.json();
      setPreview(d.board);
    } catch { /* ignore */ }
    finally { setLoadingPreview(false); }
  }

  async function handleConnect() {
    if (!apiKey.trim() || !token.trim()) { setConnectError("Both fields are required."); return; }
    setConnecting(true);
    setConnectError("");
    try {
      const r = await fetch("/api/trello/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), token: token.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setConnectError(d.error ?? "Connection failed."); return; }
      toast.success(`Connected as ${d.trelloName ?? "Trello user"}`);
      setApiKey("");
      setToken("");
      setApiStep("select");
    } catch { setConnectError("Network error. Please try again."); }
    finally { setConnecting(false); }
  }

  async function handleDisconnect() {
    await fetch("/api/trello/credentials", { method: "DELETE" });
    setTrelloBoards([]);
    setSelectedBoardId(null);
    setPreview(null);
    setApiStep("connect");
  }

  async function handleApiImport() {
    if (!selectedBoardId || !preview) return;
    setGlobalStep("importing");
    setImportError("");
    try {
      const r = await fetch(`/api/board/${boardId}/trello-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trelloBoardId: selectedBoardId }),
      });
      const text = await r.text();
      let d: { error?: string; imported?: ImportResult };
      try { d = JSON.parse(text); }
      catch {
        setImportError(`Server error: ${text.slice(0, 120)}`);
        setGlobalStep("main");
        return;
      }
      if (!r.ok) { setImportError(d.error ?? "Import failed"); setGlobalStep("main"); return; }
      setResult(d.imported!);
      setGlobalStep("done");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Network error during import.");
      setGlobalStep("main");
    }
  }

  // ── JSON helpers ──────────────────────────────────────────────────────────────

  const parseJsonFile = useCallback((file: File) => {
    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      setJsonParseError("Please select a Trello JSON export file (.json).");
      return;
    }
    setJsonParsing(true);
    setJsonParseError("");
    setJsonFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target!.result as string);
        if (!raw.lists || !raw.cards) throw new Error("Not a valid Trello board export");

        const activeLists: { id: string; name: string; pos: number }[] =
          (raw.lists as Array<{ id: string; name: string; pos: number; closed: boolean }>)
            .filter(l => !l.closed)
            .map(l => ({ id: l.id, name: l.name, pos: l.pos }));

        const activeCards: JsonCard[] =
          (raw.cards as Array<JsonCard & { closed: boolean }>)
            .filter(c => !c.closed)
            .map(c => ({
              id: c.id,
              idList: c.idList,
              name: c.name,
              desc: c.desc ?? "",
              due: c.due ?? null,
              pos: c.pos,
              cover: c.cover ? {
                scaled: ((c.cover as { scaled?: { url: string; height: number }[] }).scaled ?? [])
                  .map(s => ({ url: s.url, height: s.height })),
              } : null,
              attachments: ((c.attachments ?? []) as Array<{ name: string; url: string; mimeType: string; bytes: number }>)
                .map(a => ({ name: a.name, url: a.url, mimeType: a.mimeType, bytes: a.bytes })),
            }));

        const actions: JsonAction[] =
          ((raw.actions ?? []) as Array<{ type: string; date: string; data: { text: string; card: { id: string } }; memberCreator: { fullName: string } }>)
            .filter(a => a.type === "commentCard")
            .map(a => ({ date: a.date, data: a.data, memberCreator: a.memberCreator }));

        // Build preview
        const cardCountByList: Record<string, number> = {};
        let totalAttachments = 0;
        for (const c of activeCards) {
          cardCountByList[c.idList] = (cardCountByList[c.idList] ?? 0) + 1;
          totalAttachments += c.attachments?.length ?? 0;
        }

        const sortedLists = [...activeLists].sort((a, b) => a.pos - b.pos);
        const previewLists = sortedLists.map(l => ({
          id: l.id, name: l.name, pos: l.pos,
          cardCount: cardCountByList[l.id] ?? 0,
        }));

        setJsonPreview({
          boardName: raw.name ?? "Trello Board",
          lists: previewLists,
          totalCards: activeCards.length,
          totalComments: actions.length,
          totalAttachments,
        });
        setJsonPayload({ lists: sortedLists, cards: activeCards, actions });
        setJsonStep("preview");
      } catch (err) {
        setJsonParseError(err instanceof Error ? err.message : "Failed to parse file.");
      } finally {
        setJsonParsing(false);
      }
    };
    reader.onerror = () => { setJsonParseError("Failed to read file."); setJsonParsing(false); };
    reader.readAsText(file);
  }, []);

  async function handleJsonImport() {
    if (!jsonPayload) return;
    setGlobalStep("importing");
    setJsonImportError("");
    try {
      const r = await fetch(`/api/board/${boardId}/json-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jsonPayload),
      });
      const text = await r.text();
      let d: { error?: string; imported?: ImportResult };
      try { d = JSON.parse(text); }
      catch {
        setJsonImportError(`Server error: ${text.slice(0, 120)}`);
        setGlobalStep("main");
        return;
      }
      if (!r.ok) { setJsonImportError(d.error ?? "Import failed"); setGlobalStep("main"); return; }
      setResult(d.imported!);
      setGlobalStep("done");
    } catch (err) {
      setJsonImportError(err instanceof Error ? err.message : "Network error during import.");
      setGlobalStep("main");
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────────

  function closeAndReset() {
    setOpen(false);
    setResult(null);
    setImportError("");
    setConnectError("");
    setSelectedBoardId(null);
    setPreview(null);
    setJsonImportError("");
    setGlobalStep("main");
  }

  function switchMode(m: Mode) {
    setMode(m);
    setImportError("");
    setJsonImportError("");
  }

  // ── Mode tab switcher ─────────────────────────────────────────────────────────

  function ModeTabs() {
    return (
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
        <button
          onClick={() => switchMode("api")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
            mode === "api"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <TrelloLogo className="h-3.5 w-3.5" />
          API Import
        </button>
        <button
          onClick={() => switchMode("json")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
            mode === "json"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FileJson className="h-3.5 w-3.5" />
          JSON Upload
        </button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border/60 bg-background/60",
          "px-3 py-1.5 text-xs font-medium text-foreground/80 hover:text-foreground",
          "hover:bg-muted/60 hover:border-border transition-all duration-150 shadow-sm"
        )}
      >
        <TrelloLogo className="h-4 w-4" />
        Import from Trello
      </button>

      {mounted && createPortal(
        <>
          {/* Backdrop */}
          <div
            onClick={closeAndReset}
            className={cn(
              "fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
              open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}
            style={{ zIndex: 200 }}
          />

          {/* Dialog */}
          <div
            className={cn(
              "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
              "bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden",
              "transition-all duration-200",
              open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
            )}
            style={{ width: "min(820px, 95vw)", zIndex: 201 }}
          >

            {/* ── Importing ───────────────────────────────────────────────── */}
            {globalStep === "importing" && (
              <div className="flex flex-col items-center justify-center py-20 px-12 gap-6">
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-[#0052CC]/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#0052CC] animate-spin" />
                  <TrelloLogo className="h-7 w-7" />
                </div>
                <div className="text-center">
                  <p className="font-heading font-bold text-base">Importing your board…</p>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    Creating lists and cards. This may take up to a minute.
                  </p>
                </div>
              </div>
            )}

            {/* ── Done ────────────────────────────────────────────────────── */}
            {globalStep === "done" && result && (
              <div className="flex flex-col items-center justify-center py-20 px-12 gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-4 ring-emerald-500/20">
                  <Check className="h-8 w-8 text-emerald-500" />
                </div>
                <div className="text-center">
                  <p className="font-heading font-bold text-xl">Import complete!</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Added to <span className="font-medium text-foreground">{boardName}</span>:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-3">
                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {result.lists} list{result.lists !== 1 ? "s" : ""}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {result.cards} card{result.cards !== 1 ? "s" : ""}
                    </span>
                    {result.comments > 0 && (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                        {result.comments} comment{result.comments !== 1 ? "s" : ""}
                      </span>
                    )}
                    {result.attachments > 0 && (
                      <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                        {result.attachments} attachment{result.attachments !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Refresh the page to see your imported content.</p>
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={closeAndReset}
                    className="px-5 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border border-border/50"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh Board
                  </button>
                </div>
              </div>
            )}

            {/* ── Main (API connect) ───────────────────────────────────────── */}
            {globalStep === "main" && mode === "api" && apiStep === "connect" && (
              <div className="p-8 max-w-lg mx-auto">
                <button
                  onClick={closeAndReset}
                  className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0052CC]/10 ring-1 ring-[#0052CC]/20">
                      <TrelloLogo className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="font-heading font-bold text-lg">Import from Trello</h2>
                      <p className="text-xs text-muted-foreground">Connect your account or upload a JSON export</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <ModeTabs />
                </div>

                <div className="mb-5 rounded-xl bg-muted/40 border border-border/40 p-4 text-sm space-y-2">
                  <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">How to get your credentials</p>
                  <ol className="space-y-1.5 text-sm text-foreground/80 list-decimal list-inside">
                    <li>
                      Go to{" "}
                      <a href="https://trello.com/power-ups/admin" target="_blank" rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5">
                        trello.com/power-ups/admin <ExternalLink className="h-3 w-3" />
                      </a>{" "}
                      and create a Power-Up to get your <strong>API Key</strong>.
                    </li>
                    <li>
                      Click{" "}
                      <a href="https://trello.com/1/authorize?expiration=never&name=Boardly&scope=read&response_type=token&key=YOUR_API_KEY"
                        target="_blank" rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5">
                        Generate Token <ExternalLink className="h-3 w-3" />
                      </a>{" "}
                      (replace YOUR_API_KEY in the URL).
                    </li>
                  </ol>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">API Key</label>
                    <input
                      ref={apiKeyRef}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleConnect()}
                      placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full h-10 rounded-lg border border-input bg-background/60 px-3 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Token</label>
                    <input
                      value={token}
                      onChange={e => setToken(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleConnect()}
                      placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full h-10 rounded-lg border border-input bg-background/60 px-3 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all"
                    />
                  </div>

                  {connectError && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {connectError}
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleConnect}
                      disabled={connecting || !apiKey.trim() || !token.trim()}
                      className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all",
                        connecting || !apiKey.trim() || !token.trim()
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-[#0052CC] text-white hover:bg-[#0043A8] shadow-md"
                      )}
                    >
                      {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      {connecting ? "Connecting…" : "Connect"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Main (API select) ────────────────────────────────────────── */}
            {globalStep === "main" && mode === "api" && apiStep === "select" && (
              <div className="flex flex-col" style={{ height: "min(600px, 88vh)" }}>
                {/* Header */}
                <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-border/40 shrink-0">
                  <TrelloLogo className="h-6 w-6" />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-heading font-bold text-base">Import from Trello</h2>
                    <p className="text-xs text-muted-foreground truncate">
                      Importing into <span className="font-medium text-foreground">{boardName}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ModeTabs />
                    <button onClick={loadBoards} disabled={loadingBoards}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors" title="Refresh">
                      <RefreshCw className={cn("h-3.5 w-3.5", loadingBoards && "animate-spin")} />
                    </button>
                    <button onClick={closeAndReset}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {importError && (
                  <div className="mx-6 mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {importError}
                  </div>
                )}

                {/* Two-column body */}
                <div className="flex flex-1 min-h-0">
                  {/* Left: board list */}
                  <div className="w-[280px] border-r border-border/40 flex flex-col shrink-0">
                    <p className="px-4 pt-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Your Trello Boards
                    </p>
                    <div className="flex-1 overflow-y-auto">
                      {loadingBoards ? (
                        <div className="flex justify-center py-12">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : trelloBoards.length === 0 ? (
                        <p className="text-center text-xs text-muted-foreground py-12 px-4">No open Trello boards found.</p>
                      ) : (
                        trelloBoards.map(b => (
                          <button
                            key={b.id}
                            onClick={() => setSelectedBoardId(b.id === selectedBoardId ? null : b.id)}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-4 py-3 text-left transition-all text-sm border-l-2",
                              selectedBoardId === b.id
                                ? "bg-[#0052CC]/8 border-l-[#0052CC] text-foreground font-medium"
                                : "border-l-transparent hover:bg-muted/40 text-foreground/80 hover:text-foreground"
                            )}
                          >
                            <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg shrink-0",
                              selectedBoardId === b.id ? "bg-[#0052CC]/15" : "bg-muted")}>
                              <LayoutList className={cn("h-3.5 w-3.5", selectedBoardId === b.id ? "text-[#0052CC]" : "text-muted-foreground")} />
                            </div>
                            <span className="flex-1 truncate">{b.name}</span>
                            {selectedBoardId === b.id && <ChevronRight className="h-3.5 w-3.5 text-[#0052CC] shrink-0" />}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Right: preview */}
                  <div className="flex-1 flex flex-col min-w-0">
                    {!selectedBoardId ? (
                      <div className="flex flex-col items-center justify-center flex-1 gap-3 px-8 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                          <LayoutList className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Select a Trello board to preview</p>
                      </div>
                    ) : loadingPreview ? (
                      <div className="flex items-center justify-center flex-1">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : preview ? (
                      <div className="flex flex-col flex-1 overflow-hidden">
                        <div className="px-5 pt-4 pb-3 border-b border-border/30 shrink-0">
                          <p className="font-heading font-bold text-sm">{preview.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {preview.lists.length} list{preview.lists.length !== 1 ? "s" : ""} · {preview.totalCards} cards
                            {preview.totalComments > 0 && ` · ${preview.totalComments} comments`}
                            {preview.totalAttachments > 0 && ` · ${preview.totalAttachments} attachments`}
                          </p>
                        </div>
                        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
                          {preview.lists.map((l, i) => (
                            <div key={l.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/40 border border-border/30 text-sm">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0052CC]/10 text-[10px] font-bold text-[#0052CC] shrink-0">{i + 1}</span>
                              <span className="flex-1 truncate font-medium">{l.name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">{l.cardCount} card{l.cardCount !== 1 ? "s" : ""}</span>
                            </div>
                          ))}
                        </div>
                        <div className="px-5 py-3 border-t border-border/30 bg-muted/20 shrink-0 space-y-1.5">
                          <p className="text-xs text-muted-foreground">
                            Will add <strong className="text-foreground">{preview.lists.length} lists</strong>
                            {" "}· <strong className="text-foreground">{preview.totalCards} cards</strong>
                            {preview.totalComments > 0 && <> · <strong className="text-foreground">{preview.totalComments} comments</strong></>}
                            {preview.totalAttachments > 0 && <> · <strong className="text-foreground">{preview.totalAttachments} attachments</strong></>}
                            {" "}to <span className="font-medium text-foreground">{boardName}</span>.
                          </p>
                          <p className="text-[11px] text-muted-foreground/70">Comments attributed to your account. Existing content is not affected.</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 px-6 py-4 border-t border-border/40 bg-muted/10 shrink-0">
                  <button onClick={handleDisconnect}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
                    <Unplug className="h-3.5 w-3.5" />
                    Disconnect
                  </button>
                  <div className="flex-1" />
                  <button onClick={closeAndReset}
                    className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleApiImport}
                    disabled={!selectedBoardId || !preview || loadingPreview}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all",
                      selectedBoardId && preview && !loadingPreview
                        ? "bg-[#0052CC] text-white hover:bg-[#0043A8] shadow-md"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    <ArrowRight className="h-4 w-4" />
                    Import Board
                  </button>
                </div>
              </div>
            )}

            {/* ── Main (JSON upload) ───────────────────────────────────────── */}
            {globalStep === "main" && mode === "json" && jsonStep === "upload" && (
              <div className="p-8 max-w-lg mx-auto">
                <button
                  onClick={closeAndReset}
                  className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0052CC]/10 ring-1 ring-[#0052CC]/20">
                      <TrelloLogo className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="font-heading font-bold text-lg">Import from Trello</h2>
                      <p className="text-xs text-muted-foreground">Upload your Trello board JSON export</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <ModeTabs />
                </div>

                {/* Instructions */}
                <div className="mb-5 rounded-xl bg-muted/40 border border-border/40 p-4 text-sm space-y-2">
                  <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">How to export from Trello</p>
                  <ol className="space-y-1.5 text-sm text-foreground/80 list-decimal list-inside">
                    <li>Open your Trello board and click <strong>Show menu</strong> (right side).</li>
                    <li>Click <strong>More</strong> → <strong>Print and export</strong>.</li>
                    <li>Select <strong>Export as JSON</strong> and save the file.</li>
                    <li>Upload it below — all cards, comments and attachments will be imported.</li>
                  </ol>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setJsonDragging(true); }}
                  onDragLeave={() => setJsonDragging(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setJsonDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) parseJsonFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-8 py-10 cursor-pointer transition-all",
                    jsonDragging
                      ? "border-[#0052CC] bg-[#0052CC]/5"
                      : "border-border/50 hover:border-[#0052CC]/50 hover:bg-muted/30"
                  )}
                >
                  {jsonParsing ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin text-[#0052CC]" />
                      <p className="text-sm font-medium text-foreground">Parsing {jsonFileName}…</p>
                      <p className="text-xs text-muted-foreground">This may take a moment for large exports.</p>
                    </>
                  ) : (
                    <>
                      <div className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
                        jsonDragging ? "bg-[#0052CC]/10" : "bg-muted"
                      )}>
                        <Upload className={cn("h-5 w-5", jsonDragging ? "text-[#0052CC]" : "text-muted-foreground")} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">Drop your Trello JSON here</p>
                        <p className="text-xs text-muted-foreground mt-1">or click to browse · .json files only</p>
                      </div>
                    </>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) parseJsonFile(f); e.target.value = ""; }}
                />

                {jsonParseError && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {jsonParseError}
                  </div>
                )}
              </div>
            )}

            {/* ── Main (JSON preview) ──────────────────────────────────────── */}
            {globalStep === "main" && mode === "json" && jsonStep === "preview" && jsonPreview && (
              <div className="flex flex-col" style={{ height: "min(600px, 88vh)" }}>
                {/* Header */}
                <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-border/40 shrink-0">
                  <TrelloLogo className="h-6 w-6" />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-heading font-bold text-base">Import from Trello</h2>
                    <p className="text-xs text-muted-foreground truncate">
                      Importing into <span className="font-medium text-foreground">{boardName}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ModeTabs />
                    <button onClick={closeAndReset}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {jsonImportError && (
                  <div className="mx-6 mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {jsonImportError}
                  </div>
                )}

                {/* File chip + board summary */}
                <div className="px-6 py-3 border-b border-border/30 shrink-0 flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5">
                    <FileJson className="h-3.5 w-3.5 text-[#0052CC] shrink-0" />
                    <span className="text-xs font-medium truncate max-w-[200px]">{jsonFileName}</span>
                    <button
                      onClick={() => { setJsonStep("upload"); setJsonPreview(null); setJsonPayload(null); setJsonFileName(""); }}
                      className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <strong className="text-foreground">{jsonPreview.boardName}</strong>
                    {" · "}{jsonPreview.lists.length} lists · {jsonPreview.totalCards} cards
                    {jsonPreview.totalComments > 0 && ` · ${jsonPreview.totalComments} comments`}
                    {jsonPreview.totalAttachments > 0 && ` · ${jsonPreview.totalAttachments} attachments`}
                  </div>
                </div>

                {/* List preview */}
                <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5">
                  {jsonPreview.lists.map((l, i) => (
                    <div key={l.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/40 border border-border/30 text-sm">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0052CC]/10 text-[10px] font-bold text-[#0052CC] shrink-0">{i + 1}</span>
                      <span className="flex-1 truncate font-medium">{l.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{l.cardCount} card{l.cardCount !== 1 ? "s" : ""}</span>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 px-6 py-4 border-t border-border/40 bg-muted/10 shrink-0">
                  <p className="text-xs text-muted-foreground flex-1">
                    Will add <strong className="text-foreground">{jsonPreview.lists.length} lists</strong>
                    {" "}· <strong className="text-foreground">{jsonPreview.totalCards} cards</strong>
                    {jsonPreview.totalComments > 0 && <> · <strong className="text-foreground">{jsonPreview.totalComments} comments</strong></>}
                    {jsonPreview.totalAttachments > 0 && <> · <strong className="text-foreground">{jsonPreview.totalAttachments} attachments</strong></>}
                    {" "}to{" "}<span className="font-medium text-foreground">{boardName}</span>.
                  </p>
                  <button onClick={closeAndReset}
                    className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleJsonImport}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-[#0052CC] text-white hover:bg-[#0043A8] transition-all shadow-md"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Import Board
                  </button>
                </div>
              </div>
            )}

          </div>
        </>,
        document.body
      )}
    </>
  );
}
