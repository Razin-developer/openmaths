import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default OG image (PRD §9: "dynamic OG images via @vercel/og") — Next 16 bundles the same
 * ImageResponse API as `next/og` directly, no separate dependency needed. Per-page overrides
 * (e.g. a tool's own generated preview) land in P2+ as sibling `opengraph-image.tsx` files in
 * each route segment. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0f",
          color: "#fafafa",
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 600, letterSpacing: -1 }}>openmaths</div>
        <div style={{ fontSize: 28, color: "#a0a0b0", marginTop: 16 }}>Watch math explain itself</div>
      </div>
    ),
    { ...size }
  );
}
