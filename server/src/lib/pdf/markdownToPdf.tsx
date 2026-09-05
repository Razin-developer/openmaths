import { Text, Link, View } from "@react-pdf/renderer";

interface InlineToken {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
}

const INLINE_PATTERN = /(\*\*.+?\*\*|\*.+?\*|\[.+?\]\(.+?\))/g;

function tokenizeInline(line: string): InlineToken[] {
  const parts = line.split(INLINE_PATTERN).filter((p) => p.length > 0);
  return parts.map((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return { text: part.slice(2, -2), bold: true };
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return { text: part.slice(1, -1), italic: true };
    }
    const linkMatch = /^\[(.+)\]\((.+)\)$/.exec(part);
    if (linkMatch) {
      return { text: linkMatch[1], href: linkMatch[2] };
    }
    return { text: part };
  });
}

function InlineText({ line, style }: { line: string; style?: Record<string, unknown> }) {
  const tokens = tokenizeInline(line);
  return (
    <Text style={{ fontSize: 10, lineHeight: 1.5, marginBottom: 2, ...style }}>
      {tokens.map((token, i) =>
        token.href ? (
          <Link key={i} src={token.href} style={{ textDecoration: "underline" }}>
            {token.text}
          </Link>
        ) : (
          <Text
            key={i}
            style={{
              fontWeight: token.bold ? 700 : undefined,
              fontStyle: token.italic ? "italic" : undefined,
            }}
          >
            {token.text}
          </Text>
        )
      )}
    </Text>
  );
}

/** Renders a small subset of Markdown (bold/italic/links, paragraphs, - and 1. lists) as react-pdf elements. */
export function renderMarkdownBlocks(markdown: string) {
  const lines = markdown.split("\n");
  const blocks: React.ReactNode[] = [];
  let paragraphLines: string[] = [];
  let key = 0;

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    blocks.push(<InlineText key={key++} line={paragraphLines.join(" ")} />);
    paragraphLines = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") {
      flushParagraph();
      continue;
    }
    const listMatch = /^(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
    if (listMatch) {
      flushParagraph();
      blocks.push(
        <View key={key++} style={{ flexDirection: "row", marginBottom: 2 }}>
          <Text style={{ fontSize: 10, width: 10 }}>{"•"}</Text>
          <View style={{ flex: 1 }}>
            <InlineText line={listMatch[1]} style={{ marginBottom: 0 }} />
          </View>
        </View>
      );
      continue;
    }
    paragraphLines.push(line);
  }
  flushParagraph();

  return blocks;
}
