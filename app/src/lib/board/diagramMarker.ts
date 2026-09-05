/**
 * The AI is instructed (see prompt.ts's ENVELOPE_CONTRACT) to place a literal "[[DIAGRAM]]" marker
 * in answerMarkdown at the point where the diagram becomes relevant, so the finished message can
 * render text, then a "Diagram drawn" card, then the rest of the explanation — instead of dumping
 * the whole answer above the diagram. The marker (plus any surrounding blank lines it sits on its
 * own line between) is never shown to the user.
 */
const MARKER_PATTERN = /\n?\s*\[\[DIAGRAM\]\]\s*\n?/;

export function splitAtDiagramMarker(content: string): { before: string; after: string | null } {
  const match = content.match(MARKER_PATTERN);
  if (!match || match.index === undefined) return { before: content, after: null };
  return {
    before: content.slice(0, match.index),
    after: content.slice(match.index + match[0].length),
  };
}

/** Used while a message is still streaming — the diagram isn't ready yet, so hide the raw marker
 * text rather than flashing "[[DIAGRAM]]" literally before generation catches up to it. */
export function stripDiagramMarker(text: string): string {
  return text.replace(MARKER_PATTERN, "\n");
}
