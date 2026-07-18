// Shared video-upload constraints, used on both client and server.
export const MAX_VIDEO_BYTES = 15 * 1024 * 1024; // 15MB
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export function isVideoType(type: string): boolean {
  return /^video\//.test(type);
}

// Validate a video File before upload. Returns an error message, or null if OK.
export function validateVideoFile(file: { type: string; size: number; name: string }): string | null {
  if (!isVideoType(file.type)) return null; // not a video — nothing to check here
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return `"${file.name}" is an unsupported video format. Use MP4, MOV, or WebM.`;
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return `"${file.name}" is larger than 15MB.`;
  }
  return null;
}
