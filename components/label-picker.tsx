"use client";

import { useState } from "react";
import { Tag, Plus, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { setCardLabel, createLabel } from "@/app/actions/label";
import { LABEL_COLORS } from "@/lib/labels";
import { LabelPill } from "@/components/card-label";
import { Button } from "@/components/ui/button";
import type { CardLabel } from "@/db/schema";

interface LabelPickerProps {
  boardId: string;
  cardId: string;
  boardLabels: CardLabel[];
  assignedIds: string[];
  onAssignedChange: (ids: string[]) => void;
  onBoardLabelsChange: (labels: CardLabel[]) => void;
}

export function LabelPicker({
  boardId,
  cardId,
  boardLabels,
  assignedIds,
  onAssignedChange,
  onBoardLabelsChange,
}: LabelPickerProps) {
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState(LABEL_COLORS[0]);
  const [savingNew, setSavingNew] = useState(false);

  const assigned = new Set(assignedIds);
  const assignedLabels = boardLabels.filter((l) => assigned.has(l.id));

  async function toggle(label: CardLabel) {
    const nowAssigned = !assigned.has(label.id);
    setPendingId(label.id);
    // optimistic
    const next = nowAssigned
      ? [...assignedIds, label.id]
      : assignedIds.filter((id) => id !== label.id);
    onAssignedChange(next);

    const result = await setCardLabel(cardId, label.id, nowAssigned);
    setPendingId(null);
    if (!result.success) {
      toast.error(result.error);
      onAssignedChange(assignedIds); // revert
    }
  }

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    setSavingNew(true);
    const result = await createLabel(boardId, { title, color: newColor });
    setSavingNew(false);
    if (!result.success || !result.label) {
      toast.error(result.success ? "Could not create label." : result.error);
      return;
    }
    onBoardLabelsChange([...boardLabels, result.label]);
    setNewTitle("");
    setNewColor(LABEL_COLORS[0]);
    setCreating(false);
    // auto-assign the freshly created label
    onAssignedChange([...assignedIds, result.label.id]);
    await setCardLabel(cardId, result.label.id, true);
  }

  return (
    <div className="space-y-1.5">
      <Label />
      <div className="flex flex-wrap items-center gap-1.5">
        {assignedLabels.map((l) => (
          <LabelPill key={l.id} label={l} />
        ))}

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
          >
            <Plus className="h-3 w-3" />
            {assignedLabels.length === 0 ? "Add labels" : "Edit"}
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-30 w-64 rounded-xl border border-border bg-popover shadow-lg p-2 space-y-1">
                <p className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Labels
                </p>
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {boardLabels.map((label) => {
                    const isOn = assigned.has(label.id);
                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => toggle(label)}
                        disabled={pendingId === label.id}
                        className="w-full flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-muted/60 transition-colors"
                      >
                        <span className="flex-1 text-left">
                          <LabelPill label={label} />
                        </span>
                        {pendingId === label.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : isOn ? (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        ) : null}
                      </button>
                    );
                  })}
                  {boardLabels.length === 0 && (
                    <p className="px-1 py-2 text-xs text-muted-foreground">No labels yet.</p>
                  )}
                </div>

                <div className="border-t border-border/60 pt-1.5">
                  {creating ? (
                    <div className="space-y-1.5 p-1">
                      <input
                        autoFocus
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        maxLength={50}
                        placeholder="Label name"
                        className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring/50"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreate();
                          if (e.key === "Escape") setCreating(false);
                        }}
                      />
                      <div className="flex flex-wrap gap-1">
                        {LABEL_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setNewColor(c)}
                            style={{ backgroundColor: c }}
                            className={`h-5 w-5 rounded-full border-2 transition-transform ${
                              newColor === c ? "border-foreground scale-110" : "border-transparent"
                            }`}
                            aria-label={`Color ${c}`}
                          />
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="h-6 flex-1 text-xs gap-1"
                          onClick={handleCreate}
                          disabled={savingNew || !newTitle.trim()}
                        >
                          {savingNew ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Create
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                          onClick={() => setCreating(false)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCreating(true)}
                      className="w-full flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create a new label
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Label() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide font-medium">
      <Tag className="h-3.5 w-3.5" />
      Labels
    </div>
  );
}
