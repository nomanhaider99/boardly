"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createWorkspace } from "@/app/actions/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const COLOR_OPTIONS = [
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#a855f7", label: "Purple" },
  { value: "#f97316", label: "Orange" },
  { value: "#ec4899", label: "Pink" },
  { value: "#14b8a6", label: "Teal" },
];

export function CreateWorkspaceDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconColor, setIconColor] = useState(COLOR_OPTIONS[0].value);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData();
    fd.append("name", name);
    fd.append("description", description);
    fd.append("iconColor", iconColor);

    const result = await createWorkspace(fd);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    toast.success("Workspace created!");
    setOpen(false);
    setName("");
    setDescription("");
    setIconColor(COLOR_OPTIONS[0].value);
    router.push(`/workspace/${result.workspaceId}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New workspace
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a workspace</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input
              id="ws-name"
              placeholder="e.g. Acme Marketing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={50}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ws-desc">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="ws-desc"
              placeholder="What is this workspace for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Icon color</Label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setIconColor(c.value)}
                  className="h-7 w-7 rounded-lg border-2 transition-all"
                  style={{
                    backgroundColor: c.value,
                    borderColor: iconColor === c.value ? "white" : "transparent",
                    transform: iconColor === c.value ? "scale(1.15)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 p-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-heading font-bold text-white text-base"
              style={{ backgroundColor: iconColor }}
            >
              {name ? name.charAt(0).toUpperCase() : "W"}
            </div>
            <div>
              <p className="text-sm font-medium">{name || "Workspace name"}</p>
              <p className="text-xs text-muted-foreground">
                {description || "No description"}
              </p>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create workspace"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
