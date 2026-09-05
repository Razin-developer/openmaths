import { ImageResponse } from "next/og";
import { getAllPosts } from "@/lib/content";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Per-post OG image (PRD §8: "dynamic OG images"), not the site-wide default — a shared link to
 * a specific post should preview that post's own title/category, not the generic "openmaths"
 * card every other page falls back to. */
export default async function BlogPostOpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const posts = await getAllPosts();
  const post = posts.find((p) => p.slug === slug);

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
          {post?.category ?? "openmaths"}
        </div>
        <div style={{ display: "flex", fontSize: 56, fontWeight: 600, lineHeight: 1.2 }}>{post?.title ?? "openmaths"}</div>
        <div style={{ display: "flex", fontSize: 28, color: "#a0a0b0" }}>openmaths.com</div>
      </div>
    ),
    { ...size }
  );
}
