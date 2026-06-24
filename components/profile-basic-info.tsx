"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile, updateAvatar } from "@/app/actions/profile";
import { useUploadThing } from "@/lib/uploadthing";

interface Props {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
}

export function ProfileBasicInfo({ firstName, lastName, email, avatarUrl }: Props) {
  const router = useRouter();
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload } = useUploadThing("userAvatar", {
    onClientUploadComplete: async (res) => {
      const url = res[0]?.url;
      if (!url) return;
      const result = await updateAvatar(url);
      if (result.success) {
        toast.success("Avatar updated.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to update avatar.");
      }
      setUploading(false);
    },
    onUploadError: (err) => {
      toast.error(err.message);
      setUploading(false);
    },
  });

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await startUpload([file]);
  }

  async function handleSave() {
    setSaving(true);
    const result = await updateProfile({ firstName: first, lastName: last });
    setSaving(false);
    if (result.success) {
      toast.success("Profile updated.");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to update profile.");
    }
  }

  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  return (
    <section className="rounded-xl border border-border bg-card p-6 space-y-5">
      <h2 className="text-base font-semibold">Basic Information</h2>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Avatar"
              fill
              className="rounded-full object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">{initials}</span>
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div>
          <p className="text-sm font-medium">
            {firstName} {lastName}
          </p>
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
      </div>

      {/* Name fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            maxLength={50}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            maxLength={50}
          />
        </div>
      </div>

      {/* Email — read-only */}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled className="opacity-60" />
        <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || uploading || (first === firstName && last === lastName)}
          size="sm"
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </section>
  );
}
