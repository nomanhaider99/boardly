"use client";

import { useState } from "react";
import { Image, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateBoardBackground } from "@/app/actions/board";
import { toast } from "sonner";

const DEFAULT_BACKGROUNDS = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80",
  "https://images.unsplash.com/photo-1497215842964-222b430dc094?w=1920&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80",
  "https://images.unsplash.com/photo-1501596205831-64d05e67e7fa?w=1920&q=80",
];

interface BoardBackgroundPickerProps {
  boardId: string;
  currentBackground: string | null;
  onBackgroundChange: (url: string | null) => void;
}

export function BoardBackgroundPicker({ boardId, currentBackground, onBackgroundChange }: BoardBackgroundPickerProps) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(currentBackground);
  const [loading, setLoading] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadUrl, setUploadUrl] = useState("");

  async function handleSelect(url: string | null) {
    setLoading(url ?? "remove");
    const result = await updateBoardBackground(boardId, url);
    setLoading(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setSelectedUrl(url);
    onBackgroundChange(url);
    toast.success(url ? "Background updated" : "Background removed");
  }

  async function handleCustomUpload() {
    if (!uploadUrl.trim()) return;
    try {
      new URL(uploadUrl);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }
    setLoading(uploadUrl);
    const result = await updateBoardBackground(boardId, uploadUrl.trim());
    setLoading(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setSelectedUrl(uploadUrl.trim());
    onBackgroundChange(uploadUrl.trim());
    toast.success("Custom background uploaded");
    setShowUpload(false);
    setUploadUrl("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Board Background</h3>
        {currentBackground && (
          <Button variant="ghost" size="sm" onClick={() => handleSelect(null)} disabled={loading !== null}>
            Remove
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {DEFAULT_BACKGROUNDS.map((url) => (
          <button
            key={url}
            onClick={() => handleSelect(url)}
            disabled={loading !== null}
            className={`
              relative aspect-video rounded-xl overflow-hidden border-2 transition-all
              ${selectedUrl === url ? "border-primary scale-[0.98]" : "border-transparent hover:border-primary/50"}
            `}
          >
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${url})` }} />
            {selectedUrl === url && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <Check className="h-6 w-6 text-white" />
              </div>
            )}
            {loading === url && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              </div>
            )}
          </button>
        ))}

        <button
          onClick={() => setShowUpload(true)}
          disabled={loading !== null}
          className="relative aspect-video rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex items-center justify-center"
        >
          <div className="text-center">
            <Image className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Add custom URL</p>
          </div>
        </button>
      </div>

      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Custom Background</h3>
            <p className="text-sm text-muted-foreground mb-4">Enter a direct image URL (must end in .jpg, .png, .webp, etc.)</p>
            <input
              type="url"
              value={uploadUrl}
              onChange={(e) => setUploadUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setShowUpload(false); setUploadUrl(""); }}>
                Cancel
              </Button>
              <Button onClick={handleCustomUpload} disabled={loading !== null || !uploadUrl.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}