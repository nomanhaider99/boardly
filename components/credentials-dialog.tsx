"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, X, Key, Save, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createCredential, updateCredential, deleteCredential, getCardCredentials, type CredentialActionResult } from "@/app/actions/credential";
import type { CardCredential, CredentialField } from "@/db/schema";

interface CredentialsDialogProps {
  cardId: string;
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CredentialWithFields extends CardCredential {
  fields: CredentialField[];
}

export function CredentialsDialog({ cardId, boardId, open, onOpenChange }: CredentialsDialogProps) {
  const [credentials, setCredentials] = useState<CredentialWithFields[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftIcon, setDraftIcon] = useState("");
  const [draftFields, setDraftFields] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }]);
  const [saving, setSaving] = useState(false);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      loadCredentials();
    }
  }, [open, cardId]);

  async function loadCredentials() {
    setLoading(true);
    const data = await getCardCredentials(cardId);
    setCredentials(data as CredentialWithFields[]);
    setLoading(false);
  }

  async function handleCreate() {
    if (!draftTitle.trim()) return;
    setSaving(true);
    const formData = new FormData();
    formData.append("title", draftTitle);
    formData.append("icon", draftIcon);
    draftFields.forEach((f, i) => {
      if (f.key.trim() && f.value.trim()) {
        formData.append(`field_key_${i}`, f.key);
        formData.append(`field_value_${i}`, f.value);
      }
    });
    const result = await createCredential(cardId, formData);
    setSaving(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Credential created");
    resetDraft();
    loadCredentials();
  }

  async function handleUpdate(cred: CredentialWithFields) {
    if (!draftTitle.trim()) return;
    setSaving(true);
    const formData = new FormData();
    formData.append("title", draftTitle);
    formData.append("icon", draftIcon);
    draftFields.forEach((f, i) => {
      if (f.key.trim() && f.value.trim()) {
        formData.append(`field_key_${i}`, f.key);
        formData.append(`field_value_${i}`, f.value);
      }
    });
    const result = await updateCredential(cred.id, formData);
    setSaving(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Credential updated");
    setEditingId(null);
    resetDraft();
    loadCredentials();
  }

  async function handleDelete(credId: string) {
    if (!confirm("Delete this credential entry?")) return;
    const result = await deleteCredential(credId);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Credential deleted");
    loadCredentials();
  }

  function startEdit(cred: CredentialWithFields) {
    setEditingId(cred.id);
    setDraftTitle(cred.title);
    setDraftIcon(cred.icon ?? "");
    setDraftFields(
      cred.fields.length > 0
        ? cred.fields.map((f) => ({ key: f.key, value: f.value }))
        : [{ key: "", value: "" }]
    );
  }

  function resetDraft() {
    setDraftTitle("");
    setDraftIcon("");
    setDraftFields([{ key: "", value: "" }]);
    setEditingId(null);
  }

  function addField() {
    setDraftFields((prev) => [...prev, { key: "", value: "" }]);
  }

  function removeField(idx: number) {
    setDraftFields((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateField(idx: number, key: string, value: string) {
    setDraftFields((prev) => prev.map((f, i) => (i === idx ? { ...f, [key]: value } : f)));
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Credentials</DialogTitle>
          <DialogDescription>
            Store sensitive key/value pairs for this card (API keys, passwords, tokens, etc.)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {credentials.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No credentials yet</p>
              <p className="text-sm">Add your first credential entry</p>
            </div>
          ) : (
            <div className="space-y-3">
              {credentials.map((cred) => (
                <CredentialCard
                  key={cred.id}
                  credential={cred}
                  showValues={showValues[cred.id] ?? false}
                  onToggleShow={() => setShowValues((prev) => ({ ...prev, [cred.id]: !prev[cred.id] }))}
                  onEdit={() => startEdit(cred)}
                  onDelete={() => handleDelete(cred.id)}
                />
              ))}
            </div>
          )}

          {(editingId || !credentials.length) && (
            <CredentialForm
              title={draftTitle}
              icon={draftIcon}
              fields={draftFields}
              onTitleChange={setDraftTitle}
              onIconChange={setDraftIcon}
              onFieldChange={updateField}
              onAddField={addField}
              onRemoveField={removeField}
              onCancel={resetDraft}
              onSubmit={editingId
                ? () => handleUpdate(credentials.find((c) => c.id === editingId)!)
                : handleCreate}
              submitting={saving}
              submitLabel={editingId ? "Save Changes" : "Create Credential"}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredentialCard({
  credential,
  showValues,
  onToggleShow,
  onEdit,
  onDelete,
}: {
  credential: CredentialWithFields;
  showValues: boolean;
  onToggleShow: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {credential.icon && <span className="text-lg">{credential.icon}</span>}
          <h4 className="font-semibold">{credential.title}</h4>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onToggleShow} aria-label={showValues ? "Hide values" : "Show values"}>
            {showValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit">
            <Save className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete" className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {credential.fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No fields added yet</p>
      ) : (
        <div className="space-y-2">
          {credential.fields.map((field, i) => (
            <div key={field.id || i} className="flex items-center gap-2 rounded-lg border border-border/50 bg-background p-2">
              <Label className="w-24 text-xs font-medium text-muted-foreground truncate pr-2">
                {field.key || "Untitled"}
              </Label>
              <div className="flex-1 min-w-0">
                <input
                  type={showValues ? "text" : "password"}
                  value={field.value}
                  readOnly
                  className="w-full bg-transparent text-sm font-mono text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(field.value)} aria-label="Copy value">
                <Key className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CredentialForm({
  title,
  icon,
  fields,
  onTitleChange,
  onIconChange,
  onFieldChange,
  onAddField,
  onRemoveField,
  onCancel,
  onSubmit,
  submitting,
  submitLabel,
}: {
  title: string;
  icon: string;
  fields: { key: string; value: string }[];
  onTitleChange: (v: string) => void;
  onIconChange: (v: string) => void;
  onFieldChange: (idx: number, key: string, value: string) => void;
  onAddField: () => void;
  onRemoveField: (idx: number) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
      <h4 className="font-semibold">{fields.length === 0 ? "Add Credential" : "Edit Credential"}</h4>

      <div className="space-y-2">
        <Label>Title</Label>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g., Hostinger Hosting Credentials"
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label>Icon (emoji or text)</Label>
        <Input
          value={icon}
          onChange={(e) => onIconChange(e.target.value)}
          placeholder="🔐 or Hostinger"
          maxLength={10}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Key / Value Pairs</Label>
          <Button variant="ghost" size="sm" onClick={onAddField}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Field
          </Button>
        </div>

        {fields.map((field, idx) => (
          <div key={idx} className="flex gap-2">
            <Input
              value={field.key}
              onChange={(e) => onFieldChange(idx, "key", e.target.value)}
              placeholder="Key (e.g., API_KEY)"
              className="flex-1"
            />
            <Input
              value={field.value}
              onChange={(e) => onFieldChange(idx, "value", e.target.value)}
              placeholder="Value"
              type="password"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => onRemoveField(idx)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remove field"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={submitting} className="ml-auto">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}