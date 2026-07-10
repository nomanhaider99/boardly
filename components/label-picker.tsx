"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, X, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getBoardLabels, createCardLabel, assignLabelToCard, unassignLabelFromCard, deleteCardLabel, type LabelActionResult } from "@/app/actions/label";
import type { CardLabel } from "@/db/schema";

interface LabelPickerProps {
  cardId: string;
  boardId: string;
  currentLabels: CardLabel[];
  onLabelsChange: (labels: CardLabel[]) => void;
}

export function LabelPicker({ cardId, boardId, currentLabels, onLabelsChange }: LabelPickerProps) {
  const [availableLabels, setAvailableLabels] = useState<CardLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabelTitle, setNewLabelTitle] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#3b82f6");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    loadLabels();
  }, [boardId]);

  async function loadLabels() {
    setLoading(true);
    const labels = await getBoardLabels(boardId);
    setAvailableLabels(labels);
    setLoading(false);
  }

  async function handleCreateLabel(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabelTitle.trim()) return;
    setCreating(true);
    const result = await createCardLabel(boardId, new FormData());
    if (!result.success) {
      toast.error(result.error);
    } else {
      toast.success("Label created");
      setNewLabelTitle("");
      setCreateDialogOpen(false);
      loadLabels();
    }
    setCreating(false);
  }

  async function handleAssign(label: CardLabel) {
    const isAssigned = currentLabels.some((l) => l.id === label.id);
    let result: LabelActionResult;
    if (isAssigned) {
      result = await unassignLabelFromCard(cardId, label.id);
    } else {
      result = await assignLabelToCard(cardId, label.id);
    }
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    const updated = isAssigned
      ? currentLabels.filter((l) => l.id !== label.id)
      : [...currentLabels, label];
    onLabelsChange(updated);
    toast.success(isAssigned ? "Label removed" : "Label added");
  }

  async function handleDeleteLabel(label: CardLabel) {
    if (!window.confirm(`Delete label "${label.title}"? This will remove it from all cards.`)) return;
    const result = await deleteCardLabel(label.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setAvailableLabels((prev) => prev.filter((l) => l.id !== label.id));
    if (currentLabels.some((l) => l.id === label.id)) {
      onLabelsChange(currentLabels.filter((l) => l.id !== label.id));
    }
    toast.success("Label deleted");
  }

  const assignedIds = new Set(currentLabels.map((l) => l.id));

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading labels…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Tag className="h-3 w-3" />
          Labels
        </Label>
        <Button variant="ghost" size="icon" onClick={() => setCreateDialogOpen(true)} aria-label="Create new label">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {availableLabels.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No labels yet. Create one to get started.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {availableLabels.map((label) => (
            <button
              key={label.id}
              onClick={() => handleAssign(label)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                assignedIds.has(label.id)
                  ? "ring-2 ring-offset-2 ring-offset-background"
                  : "opacity-60 hover:opacity-100"
              }`}
              style={{
                backgroundColor: `${label.color}20`,
                color: label.color,
                borderColor: label.color,
              }}
            >
              <span>{label.title}</span>
              {label.type === "priority" && <Tag className="h-2.5 w-2.5" />}
            </button>
          ))}
        </div>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Label</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateLabel} className="space-y-3 p-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Title</label>
              <Input
                value={newLabelTitle}
                onChange={(e) => setNewLabelTitle(e.target.value)}
                placeholder="e.g. Bug, Feature, Design"
                maxLength={30}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Color</label>
              <div className="flex gap-2">
                {[
                  "#ef4444",
                  "#f97316",
                  "#eab308",
                  "#22c55e",
                  "#06b6d4",
                  "#3b82f6",
                  "#8b5cf6",
                  "#ec4899",
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewLabelColor(c)}
                    className={`h-8 w-8 rounded-full border-2 transition-transform ${
                      newLabelColor === c ? "scale-110 border-foreground" : "border-transparent hover:border-muted-foreground/50"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={creating || !newLabelTitle.trim()} className="flex-1">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreateDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <label className={className}>{children}</label>;
}