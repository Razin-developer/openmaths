import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { BlockData, MessageData } from "@openmaths/shared/board/types";
import { renderMarkdownBlocks } from "./markdownToPdf";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: "#1a1a1a" },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 12 },
  sectionHeading: { fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 6 },
  messageBlock: { marginBottom: 10 },
  roleLabel: { fontSize: 8, color: "#666666", marginBottom: 2, textTransform: "uppercase" },
  image: { marginTop: 8, marginBottom: 8, maxWidth: "100%", border: "1pt solid #e5e5e5" },
  noteItem: { fontSize: 10, marginBottom: 4 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#999999" },
});

function MessageSection({ message }: { message: MessageData }) {
  return (
    <View style={styles.messageBlock}>
      <Text style={styles.roleLabel}>{message.role === "USER" ? "Question" : "Answer"}</Text>
      {message.role === "ASSISTANT" ? (
        renderMarkdownBlocks(message.content)
      ) : (
        <Text style={{ fontSize: 10, lineHeight: 1.5 }}>{message.content}</Text>
      )}
    </View>
  );
}

export function BlockDocument({
  block,
  diagramImageDataUrl,
}: {
  block: BlockData;
  diagramImageDataUrl?: string;
}) {
  const writeNotes = (block.scene?.ops ?? [])
    .filter((op) => op.op === "write_note")
    .sort((a, b) => a.step - b.step);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{block.title || block.prompt || "Untitled question"}</Text>

        {block.messages.map((message) => (
          <MessageSection key={message.id} message={message} />
        ))}

        {diagramImageDataUrl && (
          <>
            <Text style={styles.sectionHeading}>Diagram</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop */}
            <Image src={diagramImageDataUrl} style={styles.image} />
          </>
        )}

        {writeNotes.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Step notes</Text>
            {writeNotes.map((op, index) => (
              <Text key={op.id} style={styles.noteItem}>
                {index + 1}. {op.op === "write_note" ? op.text : ""}
              </Text>
            ))}
          </>
        )}

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
