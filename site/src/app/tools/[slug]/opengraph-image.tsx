import { ImageResponse } from "next/og";
import { getTool } from "@/lib/tools-data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ToolOpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getTool(slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#0a0a0f",
          color: "#fafafa",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#8a8fef", fontWeight: 600 }}>
          Free tool · {tool?.category ?? "Math"}
        </div>
        <div style={{ display: "flex", fontSize: 56, fontWeight: 600, lineHeight: 1.2 }}>{tool?.name ?? "openmaths"}</div>
        <div style={{ display: "flex", fontSize: 28, color: "#a0a0b0" }}>openmaths.com</div>
      </div>
    ),
    { ...size }
  );
}
