import { ImageResponse } from "next/og";

export const alt = "Proboardive — Organize your work, ship what matters";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0a0a0a 0%, #101c14 100%)",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "#22c55e",
            }}
          />
          <div style={{ fontSize: "36px", fontWeight: 800, color: "#22c55e" }}>
            Proboardive
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              fontSize: "68px",
              fontWeight: 800,
              color: "#fafafa",
              lineHeight: 1.1,
              maxWidth: "900px",
            }}
          >
            Organize your work, ship what matters.
          </div>
          <div style={{ fontSize: "30px", color: "#a1a1aa", maxWidth: "880px" }}>
            Drag-and-drop kanban boards, real-time collaboration, and an AI board
            agent that takes action for you.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
